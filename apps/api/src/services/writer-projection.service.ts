import type { SubmissionStatus, WriterStatus } from '@colophony/types';
import {
  projectWriterStatus,
  resolveWriterStatusLabel,
} from '@colophony/types';

/**
 * Stateless service that projects internal submission statuses to
 * writer-facing statuses with org-configurable display labels.
 */
export const writerProjectionService = {
  /**
   * Project an internal status to a writer-facing status + label.
   * Reads org overrides from `orgSettings.writerStatusLabels` if present.
   */
  project(
    internalStatus: SubmissionStatus,
    orgSettings?: Record<string, unknown>,
  ): { writerStatus: WriterStatus; writerStatusLabel: string } {
    const writerStatus = projectWriterStatus(internalStatus);
    const overrides = (orgSettings?.writerStatusLabels ?? undefined) as
      | Partial<Record<WriterStatus, string>>
      | undefined;
    const writerStatusLabel = resolveWriterStatusLabel(writerStatus, overrides);
    return { writerStatus, writerStatusLabel };
  },

  /**
   * Project a display string only (for embed/anonymous contexts).
   */
  projectLabel(
    internalStatus: string,
    orgSettings?: Record<string, unknown>,
  ): string {
    const writerStatus = projectWriterStatus(
      internalStatus as SubmissionStatus,
    );
    const overrides = (orgSettings?.writerStatusLabels ?? undefined) as
      | Partial<Record<WriterStatus, string>>
      | undefined;
    return resolveWriterStatusLabel(writerStatus, overrides);
  },
};
