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
// Hopper event payloads (notification triggers)
// ---------------------------------------------------------------------------

export interface HopperSubmissionSubmittedEvent {
  name: 'hopper/submission.submitted';
  data: {
    orgId: string;
    submissionId: string;
    submitterId: string;
    isEmbed?: boolean;
    submitterEmail?: string;
    statusToken?: string;
    resubmit?: boolean;
  };
}

export interface HopperSubmissionAcceptedEvent {
  name: 'hopper/submission.accepted';
  data: {
    orgId: string;
    submissionId: string;
    submitterId: string;
    comment?: string;
  };
}

export interface HopperSubmissionRejectedEvent {
  name: 'hopper/submission.rejected';
  data: {
    orgId: string;
    submissionId: string;
    submitterId: string;
    comment?: string;
    includeFeedback?: boolean;
  };
}

export interface HopperSubmissionWithdrawnEvent {
  name: 'hopper/submission.withdrawn';
  data: {
    orgId: string;
    submissionId: string;
    submitterId: string;
  };
}

export interface HopperSubmissionReviseAndResubmitEvent {
  name: 'hopper/submission.revise_and_resubmit';
  data: {
    orgId: string;
    submissionId: string;
    submitterId: string;
    comment: string;
  };
}

export interface HopperReviewerAssignedEvent {
  name: 'hopper/reviewer.assigned';
  data: {
    orgId: string;
    submissionId: string;
    reviewerUserId: string;
    assignedBy: string;
  };
}

export interface HopperDiscussionCommentEvent {
  name: 'hopper/discussion.comment_added';
  data: {
    orgId: string;
    submissionId: string;
    commentId: string;
    authorId: string;
    recipientUserIds: string[];
  };
}

export type HopperEvent =
  | HopperSubmissionSubmittedEvent
  | HopperSubmissionAcceptedEvent
  | HopperSubmissionRejectedEvent
  | HopperSubmissionWithdrawnEvent
  | HopperSubmissionReviseAndResubmitEvent
  | HopperReviewerAssignedEvent
  | HopperDiscussionCommentEvent;

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
