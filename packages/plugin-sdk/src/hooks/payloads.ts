// ── Action payloads ──

export interface SubmissionCreatedPayload {
  orgId: string;
  submissionId: string;
  submitterId: string;
  formId: string;
}

export interface SubmissionSubmittedPayload {
  orgId: string;
  submissionId: string;
  submitterId: string;
}

export interface SubmissionStatusChangedPayload {
  orgId: string;
  submissionId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
}

export interface SubmissionAssignedPayload {
  orgId: string;
  submissionId: string;
  assigneeId: string;
  assignedBy: string;
}

export interface PipelineStageChangedPayload {
  orgId: string;
  pipelineItemId: string;
  previousStage: string;
  newStage: string;
}

export interface PipelineCompletedPayload {
  orgId: string;
  pipelineItemId: string;
  submissionId: string;
}

export interface IssuePublishedPayload {
  orgId: string;
  issueId: string;
  publicationId: string;
}

export interface ReviewAssignedPayload {
  orgId: string;
  submissionId: string;
  reviewerId: string;
  assignedBy: string;
}

export interface ReviewCompletedPayload {
  orgId: string;
  submissionId: string;
  reviewerId: string;
  recommendation: string;
}

export interface PaymentCompletedPayload {
  orgId: string;
  submissionId: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export interface MemberJoinedPayload {
  orgId: string;
  userId: string;
  role: string;
}

// ── Filter payloads ──

export interface SubmissionValidationPayload {
  orgId: string;
  submissionId: string;
  data: Record<string, unknown>;
  errors: string[];
}

export interface EmailBeforeSendPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, string>;
}

export interface SubmissionExportPayload {
  orgId: string;
  submissionId: string;
  format: string;
  content: string;
}

// ── Payload map ──

export interface HookPayloadMap {
  "submission.created": SubmissionCreatedPayload;
  "submission.submitted": SubmissionSubmittedPayload;
  "submission.status_changed": SubmissionStatusChangedPayload;
  "submission.assigned": SubmissionAssignedPayload;
  "pipeline.stage_changed": PipelineStageChangedPayload;
  "pipeline.completed": PipelineCompletedPayload;
  "issue.published": IssuePublishedPayload;
  "review.assigned": ReviewAssignedPayload;
  "review.completed": ReviewCompletedPayload;
  "payment.completed": PaymentCompletedPayload;
  "member.joined": MemberJoinedPayload;
  "submission.validate": SubmissionValidationPayload;
  "email.before_send": EmailBeforeSendPayload;
  "submission.export": SubmissionExportPayload;
}
