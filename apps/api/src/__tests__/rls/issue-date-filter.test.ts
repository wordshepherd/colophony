import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { globalSetup, globalTeardown } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createPublication,
  createIssue,
} from './helpers/factories';
import { type Organization, type User } from '@colophony/db';
import { issueService } from '../../services/issue.service.js';

describe('issueService.list — date range filtering', () => {
  let org: Organization;
  let user: User;
  let pubId: string;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    org = await createOrganization();
    user = await createUser();
    await createOrgMember(org.id, user.id);
    const pub = await createPublication(org.id);
    pubId = pub.id;

    // Create issues across Jan, Feb, Mar 2026
    await createIssue(org.id, pubId, {
      title: 'Jan Issue',
      publicationDate: new Date('2026-01-15T00:00:00.000Z'),
    });
    await createIssue(org.id, pubId, {
      title: 'Feb Issue',
      publicationDate: new Date('2026-02-10T00:00:00.000Z'),
    });
    await createIssue(org.id, pubId, {
      title: 'Mar Issue',
      publicationDate: new Date('2026-03-20T00:00:00.000Z'),
    });
    await createIssue(org.id, pubId, {
      title: 'No Date Issue',
      publicationDate: null,
    });
  });

  afterAll(async () => {
    await truncateAllTables();
    await globalTeardown();
  });

  it('filters by date range from/to', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(
          tx,
          {
            from: new Date('2026-02-01T00:00:00.000Z'),
            to: new Date('2026-02-28T23:59:59.999Z'),
            page: 1,
            limit: 100,
          },
          org.id,
        ),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Feb Issue');
    expect(result.total).toBe(1);
  });

  it('ignores issues with null publicationDate when filtering by date', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(
          tx,
          {
            from: new Date('2026-01-01T00:00:00.000Z'),
            to: new Date('2026-12-31T23:59:59.999Z'),
            page: 1,
            limit: 100,
          },
          org.id,
        ),
    );

    const titles = result.items.map((i) => i.title);
    expect(titles).not.toContain('No Date Issue');
    expect(result.items).toHaveLength(3);
  });

  it('from without to returns all issues after from', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(
          tx,
          {
            from: new Date('2026-02-01T00:00:00.000Z'),
            page: 1,
            limit: 100,
          },
          org.id,
        ),
    );

    const titles = result.items.map((i) => i.title);
    expect(titles).toContain('Feb Issue');
    expect(titles).toContain('Mar Issue');
    expect(titles).not.toContain('Jan Issue');
    expect(titles).not.toContain('No Date Issue');
  });

  it('orders by publicationDate asc when date range is specified', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(
          tx,
          {
            from: new Date('2026-01-01T00:00:00.000Z'),
            to: new Date('2026-12-31T23:59:59.999Z'),
            page: 1,
            limit: 100,
          },
          org.id,
        ),
    );

    expect(result.items[0].title).toBe('Jan Issue');
    expect(result.items[1].title).toBe('Feb Issue');
    expect(result.items[2].title).toBe('Mar Issue');
  });

  it('timezone boundary: issue at UTC midnight included in correct month', async () => {
    // The Mar Issue has publicationDate: 2026-03-20T00:00:00.000Z
    // Query for March should include it
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(
          tx,
          {
            from: new Date('2026-03-01T00:00:00.000Z'),
            to: new Date('2026-03-31T23:59:59.999Z'),
            page: 1,
            limit: 100,
          },
          org.id,
        ),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Mar Issue');
  });
});
