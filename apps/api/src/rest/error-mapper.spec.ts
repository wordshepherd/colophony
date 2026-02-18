import { describe, it, expect } from 'vitest';
import { ORPCError } from '@orpc/server';
import { mapServiceError } from './error-mapper.js';
import { ForbiddenError, NotFoundError } from '../services/errors.js';

// Mock service modules to get domain error classes
vi.mock('../services/submission.service.js', () => ({
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    name = 'SubmissionNotFoundError';
  },
  NotDraftError: class NotDraftError extends Error {
    name = 'NotDraftError';
  },
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {
    name = 'InvalidStatusTransitionError';
  },
  UnscannedFilesError: class UnscannedFilesError extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class InfectedFilesError extends Error {
    name = 'InfectedFilesError';
  },
}));

vi.mock('../services/file.service.js', () => ({
  FileNotFoundError: class FileNotFoundError extends Error {
    name = 'FileNotFoundError';
  },
  FileNotCleanError: class FileNotCleanError extends Error {
    name = 'FileNotCleanError';
  },
}));

vi.mock('../services/organization.service.js', () => ({
  UserNotFoundError: class UserNotFoundError extends Error {
    name = 'UserNotFoundError';
  },
  LastAdminError: class LastAdminError extends Error {
    name = 'LastAdminError';
    constructor() {
      super('Cannot remove the last admin of an organization');
    }
  },
}));

import { vi } from 'vitest';

describe('mapServiceError (oRPC)', () => {
  it('passes through ORPCError unchanged', () => {
    const original = new ORPCError('NOT_FOUND', { message: 'gone' });
    expect(() => mapServiceError(original)).toThrow(original);
  });

  it('maps ForbiddenError to FORBIDDEN', () => {
    try {
      mapServiceError(new ForbiddenError('nope'));
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<any, any>).code).toBe('FORBIDDEN');
      expect((e as ORPCError<any, any>).message).toBe('nope');
      return;
    }
    expect.fail('should have thrown');
  });

  it('maps NotFoundError to NOT_FOUND', () => {
    try {
      mapServiceError(new NotFoundError('missing'));
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<any, any>).code).toBe('NOT_FOUND');
      return;
    }
    expect.fail('should have thrown');
  });

  it('maps PostgreSQL 23505 to CONFLICT (409)', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      detail: 'Key (slug)=(test) already exists',
    });
    try {
      mapServiceError(pgError);
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<any, any>).code).toBe('CONFLICT');
      expect((e as ORPCError<any, any>).message).toContain('already exists');
      return;
    }
    expect.fail('should have thrown');
  });

  it('maps 23505 without detail to default message', () => {
    const pgError = Object.assign(new Error('dup'), { code: '23505' });
    try {
      mapServiceError(pgError);
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<any, any>).message).toBe(
        'A record with this value already exists',
      );
      return;
    }
    expect.fail('should have thrown');
  });

  it('re-throws unknown errors as-is', () => {
    const unknown = new Error('unexpected');
    expect(() => mapServiceError(unknown)).toThrow(unknown);
  });

  it('maps LastAdminError to BAD_REQUEST', async () => {
    const { LastAdminError } =
      await import('../services/organization.service.js');
    try {
      mapServiceError(new LastAdminError());
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<any, any>).code).toBe('BAD_REQUEST');
      expect((e as ORPCError<any, any>).message).toContain('last admin');
      return;
    }
    expect.fail('should have thrown');
  });
});
