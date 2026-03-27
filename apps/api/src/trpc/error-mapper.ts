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
  MissingRevisionNotesError,
  NotReviseAndResubmitError,
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
  SubmissionNotAcceptedError,
} from '../services/pipeline.service.js';
import { ContractTemplateNotFoundError } from '../services/contract-template.service.js';
import { ContractNotFoundError } from '../services/contract.service.js';
import {
  IssueNotFoundError,
  IssueItemAlreadyExistsError,
} from '../services/issue.service.js';
import { CmsConnectionNotFoundError } from '../services/cms-connection.service.js';
import { SimSubConflictError } from '../services/simsub.service.js';
import {
  TransferNotFoundError,
  TransferInvalidStateError,
  TransferCapabilityError,
} from '../services/transfer.service.js';
import {
  MigrationNotFoundError,
  MigrationInvalidStateError,
  MigrationCapabilityError,
  MigrationAlreadyActiveError,
  MigrationUserNotFoundError,
} from '../services/migration.service.js';
import {
  EmailTemplateNotFoundError,
  InvalidMergeFieldError,
} from '../services/email-template.service.js';
import {
  ReviewerAlreadyAssignedError,
  ReviewerNotAssignedError,
  ReviewerNotOrgMemberError,
} from '../services/submission-reviewer.service.js';
import {
  DiscussionCommentNotFoundError,
  DiscussionParentNotFoundError,
} from '../services/submission-discussion.service.js';
import {
  VoteNotFoundError,
  VotingDisabledError,
  VoteOnTerminalSubmissionError,
  ScoreOutOfRangeError,
} from '../services/submission-vote.service.js';
import {
  PresetLimitExceededError,
  PresetNotFoundError,
} from '../services/queue-preset.service.js';
import { CSRImportError } from '../services/csr.service.js';
import { ExternalSubmissionNotFoundError } from '../services/external-submission.service.js';
import {
  WriterProfileNotFoundError,
  WriterProfileDuplicateError,
} from '../services/writer-profile.service.js';
import {
  TrustPeerNotFoundError,
  TrustPeerAlreadyExistsError,
  TrustPeerInvalidStateError,
  RemoteMetadataFetchError,
} from '../services/trust.service.js';
import {
  HubNotEnabledError,
  HubInstanceNotFoundError,
  HubInstanceSuspendedError,
} from '../services/hub.service.js';
import {
  CollectionNotFoundError,
  CollectionItemAlreadyExistsError,
  CollectionItemNotFoundError,
  SubmissionNotInOrgError,
} from '../services/collection.service.js';

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
  [MissingRevisionNotesError, 'BAD_REQUEST'],
  [NotReviseAndResubmitError, 'BAD_REQUEST'],
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
  [SubmissionNotAcceptedError, 'BAD_REQUEST'],
  // Contract errors
  [ContractTemplateNotFoundError, 'NOT_FOUND'],
  [ContractNotFoundError, 'NOT_FOUND'],
  // Issue errors
  [IssueNotFoundError, 'NOT_FOUND'],
  [IssueItemAlreadyExistsError, 'CONFLICT'],
  // CMS errors
  [CmsConnectionNotFoundError, 'NOT_FOUND'],
  // Transfer errors
  [TransferNotFoundError, 'NOT_FOUND'],
  [TransferInvalidStateError, 'CONFLICT'],
  [TransferCapabilityError, 'BAD_REQUEST'],
  // Migration errors
  [MigrationNotFoundError, 'NOT_FOUND'],
  [MigrationInvalidStateError, 'CONFLICT'],
  [MigrationCapabilityError, 'BAD_REQUEST'],
  [MigrationAlreadyActiveError, 'CONFLICT'],
  [MigrationUserNotFoundError, 'NOT_FOUND'],
  // Email template errors
  [EmailTemplateNotFoundError, 'NOT_FOUND'],
  [InvalidMergeFieldError, 'BAD_REQUEST'],
  // Reviewer errors
  [ReviewerAlreadyAssignedError, 'CONFLICT'],
  [ReviewerNotAssignedError, 'NOT_FOUND'],
  [ReviewerNotOrgMemberError, 'BAD_REQUEST'],
  // Discussion errors
  [DiscussionCommentNotFoundError, 'NOT_FOUND'],
  [DiscussionParentNotFoundError, 'NOT_FOUND'],
  // Vote errors
  [VoteNotFoundError, 'NOT_FOUND'],
  [VotingDisabledError, 'BAD_REQUEST'],
  [VoteOnTerminalSubmissionError, 'BAD_REQUEST'],
  [ScoreOutOfRangeError, 'BAD_REQUEST'],
  // Preset errors
  [PresetLimitExceededError, 'BAD_REQUEST'],
  [PresetNotFoundError, 'NOT_FOUND'],
  // CSR errors
  [CSRImportError, 'BAD_REQUEST'],
  // Writer workspace errors
  [ExternalSubmissionNotFoundError, 'NOT_FOUND'],
  [WriterProfileNotFoundError, 'NOT_FOUND'],
  [WriterProfileDuplicateError, 'CONFLICT'],
  // Federation trust errors
  [TrustPeerNotFoundError, 'NOT_FOUND'],
  [TrustPeerAlreadyExistsError, 'CONFLICT'],
  [TrustPeerInvalidStateError, 'CONFLICT'],
  [RemoteMetadataFetchError, 'BAD_REQUEST'],
  // Hub errors
  [HubNotEnabledError, 'NOT_FOUND'],
  [HubInstanceNotFoundError, 'NOT_FOUND'],
  [HubInstanceSuspendedError, 'FORBIDDEN'],
  // Precondition
  [FileNotCleanError, 'PRECONDITION_FAILED'],
  // Collections
  [CollectionNotFoundError, 'NOT_FOUND'],
  [CollectionItemNotFoundError, 'NOT_FOUND'],
  [CollectionItemAlreadyExistsError, 'CONFLICT'],
  [SubmissionNotInOrgError, 'NOT_FOUND'],
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
    // Sim-sub conflict — include conflict details in cause
    if (error instanceof SimSubConflictError) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: error.message,
        cause: {
          conflicts: error.conflicts,
          remoteResults: error.remoteResults,
        },
      });
    }

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
