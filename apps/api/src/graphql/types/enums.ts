import { builder } from '../builder.js';

export const SubmissionStatusEnum = builder.enumType('SubmissionStatus', {
  values: [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'HOLD',
    'WITHDRAWN',
  ] as const,
});

export const ScanStatusEnum = builder.enumType('ScanStatus', {
  values: ['PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'FAILED'] as const,
});

export const RoleEnum = builder.enumType('Role', {
  values: ['ADMIN', 'EDITOR', 'READER'] as const,
});
