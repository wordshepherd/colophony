import type { SubmissionFile } from '@colophony/db';
import { builder } from '../builder.js';
import { ScanStatusEnum } from './enums.js';

export const SubmissionFileType = builder
  .objectRef<SubmissionFile>('SubmissionFile')
  .implement({
    description:
      'A file attached to a submission (document, image, audio, or video).',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      submissionId: t.exposeString('submissionId', {
        description: 'ID of the parent submission.',
      }),
      filename: t.exposeString('filename', {
        description: 'Original filename as uploaded.',
      }),
      mimeType: t.exposeString('mimeType', {
        description: 'MIME type (e.g. application/pdf).',
      }),
      size: t.exposeInt('size', { description: 'File size in bytes.' }),
      storageKey: t.exposeString('storageKey', {
        description: 'Object storage key.',
      }),
      scanStatus: t.expose('scanStatus', {
        type: ScanStatusEnum,
        description: 'Virus scan status.',
      }),
      scannedAt: t.expose('scannedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the virus scan completed.',
      }),
      uploadedAt: t.expose('uploadedAt', {
        type: 'DateTime',
        description: 'When the file was uploaded.',
      }),
    }),
  });
