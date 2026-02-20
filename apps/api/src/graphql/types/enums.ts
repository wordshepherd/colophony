import { builder } from '../builder.js';

export const SubmissionStatusEnum = builder.enumType('SubmissionStatus', {
  description: 'Current status of a submission in the editorial workflow.',
  values: {
    DRAFT: {
      description:
        'Initial state — submission is being prepared by the author.',
    },
    SUBMITTED: { description: 'Author has submitted for review.' },
    UNDER_REVIEW: {
      description: 'Editors are actively reviewing the submission.',
    },
    ACCEPTED: { description: 'Submission has been accepted for publication.' },
    REJECTED: { description: 'Submission has been declined.' },
    HOLD: { description: 'Temporarily set aside for later consideration.' },
    WITHDRAWN: { description: 'Author has withdrawn the submission.' },
  } as const,
});

export const ScanStatusEnum = builder.enumType('ScanStatus', {
  description: 'Virus scan status for an uploaded file.',
  values: {
    PENDING: { description: 'File is queued for scanning.' },
    SCANNING: { description: 'Scan is in progress.' },
    CLEAN: { description: 'No threats detected — file is safe to download.' },
    INFECTED: { description: 'Threat detected — file has been quarantined.' },
    FAILED: {
      description: 'Scan failed — file is blocked until retry succeeds.',
    },
  } as const,
});

export const RoleEnum = builder.enumType('Role', {
  description: 'Member role within an organization.',
  values: {
    ADMIN: {
      description: 'Full access — can manage members, settings, and API keys.',
    },
    EDITOR: { description: 'Can review and manage submissions.' },
    READER: { description: 'Read-only access to submissions and files.' },
  } as const,
});
