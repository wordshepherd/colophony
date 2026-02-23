import { withRls } from '@colophony/db';
import { inngest } from '../client.js';
import type { SubmissionAcceptedEvent } from '../events.js';
import { pipelineService } from '../../services/pipeline.service.js';

/**
 * Pipeline workflow — triggered when a submission is accepted.
 *
 * Creates a pipeline item at COPYEDIT_PENDING and then waits for external
 * events to drive the item through the publication pipeline stages:
 *
 *   COPYEDIT_PENDING → COPYEDIT_IN_PROGRESS → AUTHOR_REVIEW
 *     → PROOFREAD → READY_TO_PUBLISH
 *
 * Each stage transition is triggered by a `waitForEvent` that listens for
 * the corresponding Inngest event dispatched by the API when a user performs
 * an action (e.g., assigns a copyeditor, marks copyedit complete).
 */
export const pipelineWorkflow = inngest.createFunction(
  {
    id: 'pipeline-workflow',
    name: 'Publication Pipeline Workflow',
    retries: 3,
  },
  { event: 'slate/submission.accepted' },
  async ({ event, step }) => {
    const { orgId, submissionId, publicationId } =
      event.data as SubmissionAcceptedEvent['data'];

    // Step 1: Create pipeline item (COPYEDIT_PENDING)
    const pipelineItem = await step.run('create-pipeline-item', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.create(
          tx,
          {
            submissionId,
            publicationId,
          },
          orgId,
        );
      });
    });

    const pipelineItemId = pipelineItem.id;

    // Step 2: Wait for copyeditor to be assigned
    await step.waitForEvent('wait-copyeditor-assigned', {
      event: 'slate/pipeline.copyeditor-assigned',
      if: `async.data.pipelineItemId == '${pipelineItemId}'`,
      timeout: '30d',
    });

    // Step 3: Advance to COPYEDIT_IN_PROGRESS
    await step.run('advance-to-copyedit-in-progress', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItemId,
          { stage: 'COPYEDIT_IN_PROGRESS' },
          orgId,
        );
      });
    });

    // Step 4: Wait for copyedit to be completed
    await step.waitForEvent('wait-copyedit-completed', {
      event: 'slate/pipeline.copyedit-completed',
      if: `async.data.pipelineItemId == '${pipelineItemId}'`,
      timeout: '30d',
    });

    // Step 5: Advance to AUTHOR_REVIEW
    await step.run('advance-to-author-review', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItemId,
          { stage: 'AUTHOR_REVIEW' },
          orgId,
        );
      });
    });

    // Step 6: Wait for author review response
    const authorReview = await step.waitForEvent('wait-author-review', {
      event: 'slate/pipeline.author-review-completed',
      if: `async.data.pipelineItemId == '${pipelineItemId}'`,
      timeout: '30d',
    });

    // If author rejected, stay at AUTHOR_REVIEW for manual intervention.
    // A future version could loop back to COPYEDIT_IN_PROGRESS.
    if (!authorReview || !authorReview.data.approved) {
      return { status: 'author-rejected', pipelineItemId };
    }

    // Step 7: Advance to PROOFREAD
    await step.run('advance-to-proofread', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItemId,
          { stage: 'PROOFREAD' },
          orgId,
        );
      });
    });

    // Step 8: Wait for proofread to be completed
    await step.waitForEvent('wait-proofread-completed', {
      event: 'slate/pipeline.proofread-completed',
      if: `async.data.pipelineItemId == '${pipelineItemId}'`,
      timeout: '30d',
    });

    // Step 9: Mark READY_TO_PUBLISH
    await step.run('advance-to-ready', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItemId,
          { stage: 'READY_TO_PUBLISH' },
          orgId,
        );
      });
    });

    return { status: 'ready-to-publish', pipelineItemId };
  },
);
