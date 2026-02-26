import { describe, it, expect, vi } from 'vitest';

vi.mock('@colophony/db', () => {
  const eq = vi.fn();
  const and = vi.fn();
  return {
    emailSends: {
      id: 'id',
      status: 'status',
      eventType: 'eventType',
      createdAt: 'createdAt',
    },
    eq,
    and,
  };
});

import { emailService } from './email.service.js';

describe('emailService', () => {
  it('exports expected methods', () => {
    expect(emailService.create).toBeTypeOf('function');
    expect(emailService.updateStatus).toBeTypeOf('function');
    expect(emailService.markSent).toBeTypeOf('function');
    expect(emailService.markFailed).toBeTypeOf('function');
    expect(emailService.list).toBeTypeOf('function');
  });
});
