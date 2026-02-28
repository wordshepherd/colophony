import { describe, it, expect, vi } from 'vitest';
import {
  resolveBlindMode,
  applySubmitterBlinding,
  applyVoterBlinding,
  applyAuthorBlinding,
  applyReviewerBlinding,
} from './blind-review.helper.js';

// Mock @colophony/db
vi.mock('@colophony/db', () => {
  const submissionPeriods = {
    id: 'id',
    blindReviewMode: 'blind_review_mode',
  };
  return {
    submissionPeriods,
    eq: vi.fn((_a, _b) => 'eq-condition'),
  };
});

function createMockTx(rows: unknown[] = []) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn } as unknown as import('@colophony/db').DrizzleDb;
}

describe('resolveBlindMode', () => {
  it('returns none when periodId is null', async () => {
    const tx = createMockTx();
    expect(await resolveBlindMode(tx, null)).toBe('none');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(tx.select).not.toHaveBeenCalled();
  });

  it('returns mode from DB', async () => {
    const tx = createMockTx([{ blindReviewMode: 'single_blind' }]);
    expect(await resolveBlindMode(tx, 'period-1')).toBe('single_blind');
  });

  it('returns none when period not found', async () => {
    const tx = createMockTx([]);
    expect(await resolveBlindMode(tx, 'nonexistent')).toBe('none');
  });
});

describe('applySubmitterBlinding', () => {
  it('nulls email for editor in single_blind', () => {
    const item = { submitterEmail: 'test@example.com', id: '1' };
    const result = applySubmitterBlinding(item, 'single_blind', 'EDITOR');
    expect(result.submitterEmail).toBeNull();
  });

  it('preserves email for admin in single_blind', () => {
    const item = { submitterEmail: 'test@example.com', id: '1' };
    const result = applySubmitterBlinding(item, 'single_blind', 'ADMIN');
    expect(result.submitterEmail).toBe('test@example.com');
  });
});

describe('applyVoterBlinding', () => {
  it('nulls email for editor in double_blind', () => {
    const item = { voterEmail: 'voter@example.com', id: '1' };
    const result = applyVoterBlinding(item, 'double_blind', 'EDITOR');
    expect(result.voterEmail).toBeNull();
  });

  it('preserves email for editor in single_blind', () => {
    const item = { voterEmail: 'voter@example.com', id: '1' };
    const result = applyVoterBlinding(item, 'single_blind', 'EDITOR');
    expect(result.voterEmail).toBe('voter@example.com');
  });
});

describe('applyAuthorBlinding', () => {
  it('nulls email for reader in double_blind', () => {
    const item = { authorEmail: 'author@example.com', id: '1' };
    const result = applyAuthorBlinding(item, 'double_blind', 'READER');
    expect(result.authorEmail).toBeNull();
  });

  it('preserves email for admin in double_blind', () => {
    const item = { authorEmail: 'author@example.com', id: '1' };
    const result = applyAuthorBlinding(item, 'double_blind', 'ADMIN');
    expect(result.authorEmail).toBe('author@example.com');
  });
});

describe('applyReviewerBlinding', () => {
  it('nulls email for editor in double_blind', () => {
    const item = { reviewerEmail: 'reviewer@example.com', id: '1' };
    const result = applyReviewerBlinding(item, 'double_blind', 'EDITOR');
    expect(result.reviewerEmail).toBeNull();
  });

  it('preserves email in none mode', () => {
    const item = { reviewerEmail: 'reviewer@example.com', id: '1' };
    const result = applyReviewerBlinding(item, 'none', 'EDITOR');
    expect(result.reviewerEmail).toBe('reviewer@example.com');
  });
});
