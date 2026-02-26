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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.create).toBeTypeOf('function');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.updateStatus).toBeTypeOf('function');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.markSent).toBeTypeOf('function');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.markFailed).toBeTypeOf('function');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.list).toBeTypeOf('function');
  });
});
