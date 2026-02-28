export type TemplateName =
  | 'submission-received'
  | 'submission-accepted'
  | 'submission-rejected'
  | 'submission-revise-resubmit'
  | 'submission-withdrawn'
  | 'contract-ready'
  | 'copyeditor-assigned'
  | 'editor-message'
  | 'reviewer-assigned';

export interface SubmissionTemplateData {
  submissionTitle: string;
  submitterName: string;
  submitterEmail: string;
  orgName: string;
  submissionUrl?: string;
  editorComment?: string;
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

export type TemplateData =
  | SubmissionTemplateData
  | ContractTemplateData
  | CopyeditorAssignedData
  | EditorMessageTemplateData
  | ReviewerAssignedTemplateData;
