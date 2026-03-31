export type TemplateName =
  | 'submission-received'
  | 'submission-accepted'
  | 'submission-rejected'
  | 'submission-revise-resubmit'
  | 'submission-withdrawn'
  | 'contract-ready'
  | 'copyeditor-assigned'
  | 'editor-message'
  | 'reviewer-assigned'
  | 'discussion-comment'
  | 'embed-submission-confirmation'
  | 'submission-response-reminder'
  | 'organization-invitation';

export interface SubmissionTemplateData {
  submissionTitle: string;
  submitterName: string;
  submitterEmail: string;
  orgName: string;
  submissionUrl?: string;
  editorComment?: string;
  readerFeedback?: Array<{ tags: string[]; comment: string | null }>;
}

export interface ContractTemplateData {
  submissionTitle: string;
  signerName: string;
  orgName: string;
  contractUrl?: string;
}

export interface CopyeditorAssignedData {
  submissionTitle: string;
  copyeditorName: string;
  orgName: string;
  pipelineUrl?: string;
}

export interface EditorMessageTemplateData {
  submissionTitle: string;
  orgName: string;
  editorName: string;
  messageSubject: string;
  messageBody: string; // HTML from Tiptap
}

export interface ReviewerAssignedTemplateData {
  submissionTitle: string;
  orgName: string;
  assignedByName: string;
  submissionUrl?: string;
}

export interface DiscussionCommentTemplateData {
  submissionTitle: string;
  orgName: string;
  authorName: string;
  submissionUrl?: string;
}

export interface EmbedSubmissionConfirmationData {
  submissionTitle: string;
  orgName: string;
  statusCheckUrl: string;
}

export interface ResponseReminderTemplateData {
  orgName: string;
  editorName: string;
  totalAging: number;
  oldestDays: number;
  topSubmissions: Array<{
    title: string;
    submitterEmail: string;
    daysPending: number;
  }>;
  hasMore: boolean;
  queueUrl?: string;
}

export interface OrganizationInvitationData {
  orgName: string;
  inviterName: string;
  inviteUrl: string;
  roleName: string;
  expiresAt: string;
}

export type TemplateData =
  | SubmissionTemplateData
  | ContractTemplateData
  | CopyeditorAssignedData
  | EditorMessageTemplateData
  | ReviewerAssignedTemplateData
  | DiscussionCommentTemplateData
  | EmbedSubmissionConfirmationData
  | ResponseReminderTemplateData
  | OrganizationInvitationData;
