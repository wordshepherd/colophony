import { GraphQLError } from 'graphql';
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
import {
  PublicationNotFoundError,
  PublicationSlugConflictError,
} from '../services/publication.service.js';
import {
  PipelineItemNotFoundError,
  PipelineItemAlreadyExistsError,
  InvalidPipelineTransitionError,
} from '../services/pipeline.service.js';
import { ContractTemplateNotFoundError } from '../services/contract-template.service.js';
import { ContractNotFoundError } from '../services/contract.service.js';

type GraphQLErrorCode = string;

/** Map of domain error constructors to GraphQL error extension codes. */
const errorCodeMap: [new (...args: never[]) => Error, GraphQLErrorCode][] = [
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
  // Publication errors
  [PublicationNotFoundError, 'NOT_FOUND'],
  [PublicationSlugConflictError, 'CONFLICT'],
  // Pipeline errors
  [PipelineItemNotFoundError, 'NOT_FOUND'],
  [PipelineItemAlreadyExistsError, 'CONFLICT'],
  [InvalidPipelineTransitionError, 'BAD_REQUEST'],
  // Contract errors
  [ContractTemplateNotFoundError, 'NOT_FOUND'],
  [ContractNotFoundError, 'NOT_FOUND'],
  // Precondition
  [FileNotCleanError, 'BAD_REQUEST'],
];

/**
 * Map a domain error thrown by a service method to a {@link GraphQLError}.
 *
 * - Known domain errors -> GraphQLError with appropriate extension code.
 * - PostgreSQL unique-violation (code `23505`) -> CONFLICT.
 * - Unknown errors are re-thrown as-is so Yoga's default handler returns 500.
 */
export function mapServiceError(error: unknown): never {
  if (error instanceof GraphQLError) {
    throw error;
  }

  if (error instanceof Error) {
    // Surface fieldErrors for form validation failures
    if (error instanceof InvalidFormDataError) {
      throw new GraphQLError(error.message, {
        extensions: { code: 'BAD_REQUEST', fieldErrors: error.fieldErrors },
      });
    }

    for (const [ErrorClass, code] of errorCodeMap) {
      if (error instanceof ErrorClass) {
        throw new GraphQLError(error.message, {
          extensions: { code },
        });
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
    throw new GraphQLError(
      (error as { detail?: string }).detail ??
        'A record with this value already exists',
      { extensions: { code: 'CONFLICT' } },
    );
  }

  // Unknown — re-throw for Yoga's default error handler (500)
  throw error;
}
