/**
 * Queue name constants for BullMQ job queues.
 *
 * Defined separately from jobs.module.ts to avoid circular dependencies
 * when services import these constants.
 */
export const VIRUS_SCAN_QUEUE = 'virus-scan';
export const RETENTION_QUEUE = 'retention';
export const OUTBOX_QUEUE = 'outbox';
