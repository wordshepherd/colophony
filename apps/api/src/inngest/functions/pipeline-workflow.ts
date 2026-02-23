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

    // Step 2: Wait for copyeditor to be assigned → COPYEDIT_IN_PROGRESS
    await step.waitForEvent('wait-copyeditor-assigned', {
      event: 'slate/pipeline.copyeditor-assigned',
      match: 'data.pipelineItemId',
      timeout: '30d',
    });

    // Step 3: Wait for copyedit to be completed
    await step.waitForEvent('wait-copyedit-completed', {
      event: 'slate/pipeline.copyedit-completed',
      match: 'data.pipelineItemId',
      timeout: '30d',
    });

    // Step 4: Advance to AUTHOR_REVIEW
    await step.run('advance-to-author-review', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItem.id,
          { stage: 'AUTHOR_REVIEW' },
          orgId,
        );
      });
    });

    // Step 5: Wait for author review response
    const authorReview = await step.waitForEvent('wait-author-review', {
      event: 'slate/pipeline.author-review-completed',
      match: 'data.pipelineItemId',
      timeout: '30d',
    });

    // If author rejected, loop back would need a recursive approach.
    // For v1, we advance to PROOFREAD if approved.
    if (!authorReview || !authorReview.data.approved) {
      // Author rejected — stay at AUTHOR_REVIEW for manual intervention
      return { status: 'author-rejected', pipelineItemId: pipelineItem.id };
    }

    // Step 6: Advance to PROOFREAD
    await step.run('advance-to-proofread', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItem.id,
          { stage: 'PROOFREAD' },
          orgId,
        );
      });
    });

    // Step 7: Wait for proofread to be completed
    await step.waitForEvent('wait-proofread-completed', {
      event: 'slate/pipeline.proofread-completed',
      match: 'data.pipelineItemId',
      timeout: '30d',
    });

    // Step 8: Mark READY_TO_PUBLISH
    await step.run('advance-to-ready', async () => {
      return withRls({ orgId }, async (tx) => {
        return pipelineService.updateStage(
          tx,
          pipelineItem.id,
          { stage: 'READY_TO_PUBLISH' },
          orgId,
        );
      });
    });

    return { status: 'ready-to-publish', pipelineItemId: pipelineItem.id };
  },
);
