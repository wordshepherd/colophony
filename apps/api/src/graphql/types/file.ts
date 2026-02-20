import type { SubmissionFile } from '@colophony/db';
import { builder } from '../builder.js';
import { ScanStatusEnum } from './enums.js';

export const SubmissionFileType = builder
  .objectRef<SubmissionFile>('SubmissionFile')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      submissionId: t.exposeString('submissionId'),
      filename: t.exposeString('filename'),
      mimeType: t.exposeString('mimeType'),
      size: t.exposeInt('size'),
      storageKey: t.exposeString('storageKey'),
      scanStatus: t.expose('scanStatus', { type: ScanStatusEnum }),
      scannedAt: t.expose('scannedAt', {
        type: 'DateTime',
        nullable: true,
      }),
      uploadedAt: t.expose('uploadedAt', { type: 'DateTime' }),
    }),
  });
