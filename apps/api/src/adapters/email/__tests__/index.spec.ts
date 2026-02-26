import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../smtp.adapter.js', () => ({
  createSmtpAdapter: vi.fn(() => ({ name: 'smtp' })),
}));

vi.mock('../sendgrid.adapter.js', () => ({
  createSendGridAdapter: vi.fn(() => ({ name: 'sendgrid' })),
}));

import { createEmailAdapter } from '../index.js';
import { createSmtpAdapter } from '../smtp.adapter.js';
import { createSendGridAdapter } from '../sendgrid.adapter.js';
import type { Env } from '../../../config/env.js';

describe('createEmailAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SMTP adapter when EMAIL_PROVIDER is smtp', () => {
    const adapter = createEmailAdapter({ EMAIL_PROVIDER: 'smtp' } as Env);
    expect(createSmtpAdapter).toHaveBeenCalled();
    expect(adapter?.name).toBe('smtp');
  });

  it('returns SendGrid adapter when EMAIL_PROVIDER is sendgrid', () => {
    const adapter = createEmailAdapter({ EMAIL_PROVIDER: 'sendgrid' } as Env);
    expect(createSendGridAdapter).toHaveBeenCalled();
    expect(adapter?.name).toBe('sendgrid');
  });

  it('returns null when EMAIL_PROVIDER is none', () => {
    const adapter = createEmailAdapter({ EMAIL_PROVIDER: 'none' } as Env);
    expect(adapter).toBeNull();
  });
});
