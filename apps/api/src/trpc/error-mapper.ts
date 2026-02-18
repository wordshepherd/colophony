import { TRPCError } from '@trpc/server';
import { ForbiddenError, NotFoundError } from '../services/errors.js';
import { SubmissionNotFoundError } from '../services/submission.service.js';
import { UserNotFoundError } from '../services/organization.service.js';
import {
  FileNotFoundError,
  FileNotCleanError,
} from '../services/file.service.js';
import {
  NotDraftError,
  InvalidStatusTransitionError,
  UnscannedFilesError,
  InfectedFilesError,
} from '../services/submission.service.js';
import { LastAdminError } from '../services/organization.service.js';

type TRPCErrorCode = ConstructorParameters<typeof TRPCError>[0]['code'];

/** Map of domain error constructors to tRPC error codes. */
const errorCodeMap: [new (...args: never[]) => Error, TRPCErrorCode][] = [
  // Access control
  [ForbiddenError, 'FORBIDDEN'],
  // Not found
  [NotFoundError, 'NOT_FOUND'],
  [SubmissionNotFoundError, 'NOT_FOUND'],
  [UserNotFoundError, 'NOT_FOUND'],
  [FileNotFoundError, 'NOT_FOUND'],
  // Bad request (business rule violations)
  [NotDraftError, 'BAD_REQUEST'],
  [InvalidStatusTransitionError, 'BAD_REQUEST'],
  [UnscannedFilesError, 'BAD_REQUEST'],
  [InfectedFilesError, 'BAD_REQUEST'],
  [LastAdminError, 'BAD_REQUEST'],
  // Precondition
  [FileNotCleanError, 'PRECONDITION_FAILED'],
];

/**
 * Map a domain error thrown by a service method to a {@link TRPCError}.
 *
 * - Known domain errors → appropriate tRPC code with the original message.
 * - PostgreSQL unique-violation (code `23505`) → `CONFLICT`.
 * - Unknown errors are re-thrown as-is so tRPC's default handler returns 500.
 */
export function mapServiceError(error: unknown): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof Error) {
    for (const [ErrorClass, code] of errorCodeMap) {
      if (error instanceof ErrorClass) {
        throw new TRPCError({ code, message: error.message });
      }
    }
  }

  // PostgreSQL unique violation
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  ) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        (error as { detail?: string }).detail ??
        'A record with this value already exists',
    });
  }

  // Unknown — re-throw for tRPC's default error handler (500)
  throw error;
}
