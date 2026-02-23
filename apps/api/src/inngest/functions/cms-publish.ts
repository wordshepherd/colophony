import { inngest } from '../client.js';
import {
  withRls,
  pipelineItems,
  submissions,
  eq,
  inArray,
  type DrizzleDb,
} from '@colophony/db';
import { cmsConnectionService } from '../../services/cms-connection.service.js';
import { issueService } from '../../services/issue.service.js';
import { getCmsAdapter } from '../../adapters/cms/index.js';
import type { CmsIssuePayload } from '../../adapters/cms/cms-adapter.interface.js';

/**
 * CMS publish workflow — triggered when an issue is published.
 *
 * For each active CMS connection linked to the issue's publication,
 * publishes the issue content via the appropriate CMS adapter.
 */
export const cmsPublishWorkflow = inngest.createFunction(
  {
    id: 'slate-cms-publish',
    name: 'Slate: Publish issue to CMS',
    retries: 3,
  },
  { event: 'slate/issue.published' },
  async ({ event, step }) => {
    const { orgId, issueId, publicationId } = event.data;

    // Step 1: Load issue, sections, items with submission data, and CMS connections
    const data = await step.run('load-issue-and-connections', async () => {
      return withRls({ orgId }, async (tx: DrizzleDb) => {
        const issueRow = await issueService.getById(tx, issueId);
        if (!issueRow) {
          throw new Error(`Issue ${issueId} not found`);
        }

        const [sectionRows, itemRows, conns] = await Promise.all([
          issueService.getSections(tx, issueId),
          issueService.getItems(tx, issueId),
          cmsConnectionService.listByPublication(tx, publicationId),
        ]);

        // Load submission data for each issue item via pipeline_items → submissions
        const pipelineItemIds = itemRows.map((item) => item.pipelineItemId);
        const pieceData =
          pipelineItemIds.length > 0
            ? await tx
                .select({
                  pipelineItemId: pipelineItems.id,
                  title: submissions.title,
                  content: submissions.content,
                })
                .from(pipelineItems)
                .innerJoin(
                  submissions,
                  eq(pipelineItems.submissionId, submissions.id),
                )
                .where(inArray(pipelineItems.id, pipelineItemIds))
            : [];

        return {
          issue: issueRow,
          sections: sectionRows,
          items: itemRows,
          pieceData,
          connections: conns,
        };
      });
    });

    const { issue, sections, items, pieceData, connections } = data;

    if (connections.length === 0) {
      return { status: 'skipped', reason: 'No active CMS connections' };
    }

    // Step 2: Build the CMS payload with actual submission data
    const sectionMap = new Map(sections.map((s) => [s.id, s.title]));
    const pieceMap = new Map(
      pieceData.map((p) => [
        p.pipelineItemId,
        {
          title: p.title ?? 'Untitled',
          content: p.content ?? '',
        },
      ]),
    );

    const payload: CmsIssuePayload = {
      title: issue.title,
      volume: issue.volume,
      issueNumber: issue.issueNumber,
      description: issue.description,
      coverImageUrl: issue.coverImageUrl,
      publicationDate: issue.publicationDate
        ? new Date(issue.publicationDate)
        : null,
      items: items.map((item) => {
        const piece = pieceMap.get(item.pipelineItemId) ?? {
          title: 'Untitled',
          content: '',
        };
        return {
          title: piece.title,
          content: piece.content,
          author: null,
          sortOrder: item.sortOrder,
          sectionTitle: item.issueSectionId
            ? (sectionMap.get(item.issueSectionId) ?? null)
            : null,
        };
      }),
    };

    // Step 3: Publish to each CMS connection (one step per connection for retries)
    const results = [];
    for (const conn of connections) {
      const result = await step.run(
        `publish-to-${conn.adapterType.toLowerCase()}-${conn.id.slice(0, 8)}`,
        async () => {
          const adapter = getCmsAdapter(conn.adapterType);
          const publishResult = await adapter.publishIssue(
            conn.config as Record<string, unknown>,
            payload,
          );

          // Update last sync timestamp
          await withRls({ orgId }, async (tx: DrizzleDb) => {
            await cmsConnectionService.updateLastSync(tx, conn.id);
          });

          return {
            connectionId: conn.id,
            adapterType: conn.adapterType,
            externalId: publishResult.externalId,
            externalUrl: publishResult.externalUrl,
          };
        },
      );
      results.push(result);
    }

    return { status: 'published', results };
  },
);
