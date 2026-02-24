import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { withTestRls } from '../rls/helpers/rls-context';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories';
import {
  issues,
  publications,
  type Organization,
  type User,
} from '@colophony/db';
import { issueService } from '../../services/issue.service.js';

function adminDb() {
  return drizzle(getAdminPool());
}

async function createPublication(orgId: string) {
  const db = adminDb();
  const [pub] = await db
    .insert(publications)
    .values({
      organizationId: orgId,
      name: faker.company.name(),
      slug: faker.string.alphanumeric(20).toLowerCase(),
    })
    .returning();
  return pub;
}

async function createIssue(
  orgId: string,
  publicationId: string,
  overrides?: Partial<{
    title: string;
    publicationDate: Date | null;
    status: string;
  }>,
) {
  const db = adminDb();
  const [issue] = await db
    .insert(issues)
    .values({
      organizationId: orgId,
      publicationId,
      title: overrides?.title ?? faker.lorem.words(3),
      publicationDate: overrides?.publicationDate ?? null,
      status: (overrides?.status as 'PLANNING') ?? 'PLANNING',
    })
    .returning();
  return issue;
}

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
        issueService.list(tx, {
          from: new Date('2026-02-01T00:00:00.000Z'),
          to: new Date('2026-02-28T23:59:59.999Z'),
          page: 1,
          limit: 100,
        }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Feb Issue');
    expect(result.total).toBe(1);
  });

  it('ignores issues with null publicationDate when filtering by date', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(tx, {
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-12-31T23:59:59.999Z'),
          page: 1,
          limit: 100,
        }),
    );

    const titles = result.items.map((i) => i.title);
    expect(titles).not.toContain('No Date Issue');
    expect(result.items).toHaveLength(3);
  });

  it('from without to returns all issues after from', async () => {
    const result = await withTestRls(
      { orgId: org.id, userId: user.id },
      async (tx) =>
        issueService.list(tx, {
          from: new Date('2026-02-01T00:00:00.000Z'),
          page: 1,
          limit: 100,
        }),
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
        issueService.list(tx, {
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-12-31T23:59:59.999Z'),
          page: 1,
          limit: 100,
        }),
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
        issueService.list(tx, {
          from: new Date('2026-03-01T00:00:00.000Z'),
          to: new Date('2026-03-31T23:59:59.999Z'),
          page: 1,
          limit: 100,
        }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Mar Issue');
  });
});
