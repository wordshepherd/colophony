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
  FormDefinitionMismatchError,
} from '../services/submission.service.js';
import { LastAdminError } from '../services/organization.service.js';
import {
  FormNotFoundError,
  FormFieldNotFoundError,
  FormPageNotFoundError,
  FormNotDraftError,
  FormNotPublishedError,
  DuplicateFieldKeyError,
  FormHasNoFieldsError,
  FormInUseError,
  InvalidFormDataError,
  InvalidBranchReferenceError,
} from '../services/form.service.js';
import {
  PeriodNotFoundError,
  PeriodHasSubmissionsError,
} from '../services/period.service.js';
import {
  ManuscriptNotFoundError,
  ManuscriptVersionNotFoundError,
} from '../services/manuscript.service.js';

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
  [ManuscriptNotFoundError, 'NOT_FOUND'],
  [ManuscriptVersionNotFoundError, 'NOT_FOUND'],
  // Bad request (business rule violations)
  [NotDraftError, 'BAD_REQUEST'],
  [InvalidStatusTransitionError, 'BAD_REQUEST'],
  [UnscannedFilesError, 'BAD_REQUEST'],
  [InfectedFilesError, 'BAD_REQUEST'],
  [FormDefinitionMismatchError, 'BAD_REQUEST'],
  [LastAdminError, 'BAD_REQUEST'],
  // Form errors
  [FormNotFoundError, 'NOT_FOUND'],
  [FormFieldNotFoundError, 'NOT_FOUND'],
  [FormPageNotFoundError, 'NOT_FOUND'],
  [FormNotDraftError, 'BAD_REQUEST'],
  [FormNotPublishedError, 'BAD_REQUEST'],
  [DuplicateFieldKeyError, 'CONFLICT'],
  [FormHasNoFieldsError, 'BAD_REQUEST'],
  [FormInUseError, 'BAD_REQUEST'],
  [InvalidFormDataError, 'BAD_REQUEST'],
  [InvalidBranchReferenceError, 'BAD_REQUEST'],
  // Period errors
  [PeriodNotFoundError, 'NOT_FOUND'],
  [PeriodHasSubmissionsError, 'BAD_REQUEST'],
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
    // Surface fieldErrors for form validation failures
    if (error instanceof InvalidFormDataError) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message,
        cause: { fieldErrors: error.fieldErrors },
      });
    }

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
