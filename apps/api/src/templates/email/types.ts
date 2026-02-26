export type TemplateName =
  | 'submission-received'
  | 'submission-accepted'
  | 'submission-rejected'
  | 'submission-withdrawn'
  | 'contract-ready'
  | 'copyeditor-assigned';

export interface SubmissionTemplateData {
  submissionTitle: string;
  submitterName: string;
  submitterEmail: string;
  orgName: string;
  submissionUrl?: string;
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

export type TemplateData =
  | SubmissionTemplateData
  | ContractTemplateData
  | CopyeditorAssignedData;
