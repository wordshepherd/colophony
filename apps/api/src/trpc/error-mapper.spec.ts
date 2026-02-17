import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { mapServiceError } from './error-mapper.js';
import { ForbiddenError, NotFoundError } from '../services/errors.js';
import {
  SubmissionNotFoundError,
  InvalidStatusTransitionError,
  NotDraftError,
  UnscannedFilesError,
  InfectedFilesError,
} from '../services/submission.service.js';
import {
  UserNotFoundError,
  LastAdminError,
} from '../services/organization.service.js';
import { FileNotFoundError } from '../services/file.service.js';

function catchTRPCError(error: unknown): TRPCError {
  try {
    mapServiceError(error);
  } catch (e) {
    if (e instanceof TRPCError) return e;
    throw e;
  }
  throw new Error('mapServiceError should have thrown');
}

describe('mapServiceError', () => {
  it('maps ForbiddenError → FORBIDDEN', () => {
    const err = catchTRPCError(new ForbiddenError('no access'));
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('no access');
  });

  it('maps NotFoundError → NOT_FOUND', () => {
    const err = catchTRPCError(new NotFoundError('gone'));
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('gone');
  });

  it('maps SubmissionNotFoundError → NOT_FOUND', () => {
    const err = catchTRPCError(new SubmissionNotFoundError('abc'));
    expect(err.code).toBe('NOT_FOUND');
  });

  it('maps UserNotFoundError → NOT_FOUND', () => {
    const err = catchTRPCError(new UserNotFoundError('test@test.com'));
    expect(err.code).toBe('NOT_FOUND');
  });

  it('maps FileNotFoundError → NOT_FOUND', () => {
    const err = catchTRPCError(new FileNotFoundError('f1'));
    expect(err.code).toBe('NOT_FOUND');
  });

  it('maps NotDraftError → BAD_REQUEST', () => {
    const err = catchTRPCError(new NotDraftError());
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('maps InvalidStatusTransitionError → BAD_REQUEST', () => {
    const err = catchTRPCError(
      new InvalidStatusTransitionError('DRAFT', 'ACCEPTED'),
    );
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('maps UnscannedFilesError → BAD_REQUEST', () => {
    const err = catchTRPCError(new UnscannedFilesError());
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('maps InfectedFilesError → BAD_REQUEST', () => {
    const err = catchTRPCError(new InfectedFilesError());
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('maps LastAdminError → BAD_REQUEST', () => {
    const err = catchTRPCError(new LastAdminError());
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('maps PostgreSQL unique violation (23505) → CONFLICT', () => {
    const pgError = {
      code: '23505',
      detail: 'Key (slug)=(test) already exists',
    };
    const err = catchTRPCError(pgError);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toContain('already exists');
  });

  it('maps PostgreSQL unique violation without detail → CONFLICT with default message', () => {
    const pgError = { code: '23505' };
    const err = catchTRPCError(pgError);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toContain('already exists');
  });

  it('passes through existing TRPCError unchanged', () => {
    const original = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'not authed',
    });
    const err = catchTRPCError(original);
    expect(err).toBe(original);
  });

  it('re-throws unknown errors as-is', () => {
    const unknown = new Error('something unexpected');
    expect(() => mapServiceError(unknown)).toThrow(unknown);
  });

  it('re-throws non-Error values as-is', () => {
    expect(() => mapServiceError('string error')).toThrow('string error');
  });
});
