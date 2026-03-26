import type { ProseMirrorDoc, GenreHint } from '@colophony/types';
import { convertTextToProseMirror } from './text-converter.js';
import { convertDocxToProseMirror } from './docx-converter.js';
import { applySmartTypography } from './smart-typography.js';

export type ConversionResult =
  | { status: 'success'; doc: ProseMirrorDoc }
  | { status: 'unsupported'; mimeType: string };

/** MIME types we can extract content from. */
export const SUPPORTED_MIME_TYPES = new Set([
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Maximum file size for content extraction (50 MB). */
const MAX_EXTRACT_SIZE = 50 * 1024 * 1024;

export const CONVERTER_VERSION = '1.0.0';

/**
 * Convert a file buffer to ProseMirror JSON based on MIME type.
 * Applies smart typography after format-specific conversion.
 */
export async function convertFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  genreHint?: GenreHint,
): Promise<ConversionResult> {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return { status: 'unsupported', mimeType };
  }

  if (buffer.length > MAX_EXTRACT_SIZE) {
    return { status: 'unsupported', mimeType: `${mimeType} (exceeds 50MB)` };
  }

  let doc: ProseMirrorDoc;

  switch (mimeType) {
    case 'text/plain': {
      const text = buffer.toString('utf-8');
      doc = convertTextToProseMirror(text, genreHint);
      break;
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      doc = await convertDocxToProseMirror(buffer, genreHint);
      break;
    }
    default:
      return { status: 'unsupported', mimeType };
  }

  // Apply smart typography pass
  doc = applySmartTypography(doc);

  // Set submission metadata
  doc.attrs = {
    ...doc.attrs,
    submission_metadata: {
      original_filename: filename,
      original_format: mimeType,
      converted_at: new Date().toISOString(),
      converter_version: CONVERTER_VERSION,
    },
  };

  return { status: 'success', doc };
}

export { convertTextToProseMirror } from './text-converter.js';
export { convertDocxToProseMirror } from './docx-converter.js';
export { applySmartTypography, smartifyText } from './smart-typography.js';
