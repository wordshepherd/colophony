/**
 * Typed Inngest event definitions for the Slate publication pipeline.
 *
 * Events are dispatched via the transactional outbox (`outbox_events` table)
 * to ensure they are only sent after the DB transaction commits.
 */

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

export interface SubmissionAcceptedEvent {
  name: 'slate/submission.accepted';
  data: {
    orgId: string;
    submissionId: string;
    publicationId?: string;
  };
}

export interface CopyeditorAssignedEvent {
  name: 'slate/pipeline.copyeditor-assigned';
  data: {
    orgId: string;
    pipelineItemId: string;
    copyeditorId: string;
  };
}

export interface CopyeditCompletedEvent {
  name: 'slate/pipeline.copyedit-completed';
  data: {
    orgId: string;
    pipelineItemId: string;
  };
}

export interface AuthorReviewCompletedEvent {
  name: 'slate/pipeline.author-review-completed';
  data: {
    orgId: string;
    pipelineItemId: string;
    approved: boolean;
  };
}

export interface ProofreadCompletedEvent {
  name: 'slate/pipeline.proofread-completed';
  data: {
    orgId: string;
    pipelineItemId: string;
  };
}

export interface ContractGeneratedEvent {
  name: 'slate/contract.generated';
  data: {
    orgId: string;
    contractId: string;
    pipelineItemId: string;
  };
}

export interface ContractSignedEvent {
  name: 'slate/contract.signed';
  data: {
    orgId: string;
    contractId: string;
    documensoDocumentId: string;
  };
}

export interface ContractCompletedEvent {
  name: 'slate/contract.completed';
  data: {
    orgId: string;
    contractId: string;
    documensoDocumentId: string;
  };
}

export interface IssuePublishedEvent {
  name: 'slate/issue.published';
  data: {
    orgId: string;
    issueId: string;
    publicationId: string;
  };
}

// ---------------------------------------------------------------------------
// Union type for all Slate events
// ---------------------------------------------------------------------------

export type SlateEvent =
  | SubmissionAcceptedEvent
  | CopyeditorAssignedEvent
  | CopyeditCompletedEvent
  | AuthorReviewCompletedEvent
  | ProofreadCompletedEvent
  | ContractGeneratedEvent
  | ContractSignedEvent
  | ContractCompletedEvent
  | IssuePublishedEvent;
