/**
 * Contract service integration tests.
 *
 * Tests contract lifecycle (template → instance → status transitions)
 * with real PostgreSQL and RLS enforcement.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { contracts, contractTemplates, pipelineItems } from '@colophony/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { globalSetup, getAdminPool } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmission,
} from '../rls/helpers/factories.js';

function adminDb(): any {
  return drizzle(getAdminPool());
}

async function createPipelineItem(
  orgId: string,
  submissionId: string,
): Promise<{ id: string }> {
  const db = adminDb();
  const [item] = await db
    .insert(pipelineItems)
    .values({
      organizationId: orgId,
      submissionId,
      stage: 'COPYEDIT_PENDING',
    })
    .returning();
  return item;
}

async function createContractTemplate(
  orgId: string,
  overrides?: Partial<{ name: string; body: string }>,
): Promise<{ id: string; name: string; body: string }> {
  const db = adminDb();
  const [template] = await db
    .insert(contractTemplates)
    .values({
      organizationId: orgId,
      name: overrides?.name ?? 'Standard Publication Agreement',
      body:
        overrides?.body ??
        'This agreement between {{author_name}} and {{publication}}...',
    })
    .returning();
  return template;
}

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('contract service — integration', () => {
  describe('contract template CRUD', () => {
    it('creates a contract template visible in org context', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const template = await createContractTemplate(org.id, {
        name: 'First Serial Rights',
      });

      const fetched = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .select()
          .from(contractTemplates)
          .where(eq(contractTemplates.id, template.id))
          .limit(1);
        return row;
      });

      expect(fetched).toBeDefined();
      expect(fetched.name).toBe('First Serial Rights');
    });

    it('org B cannot see org A templates', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();

      await createContractTemplate(orgA.id, { name: 'A Template' });

      const results = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return tx.select().from(contractTemplates);
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('contract lifecycle', () => {
    it('creates a contract from template + pipeline item', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const submission = await createSubmission(org.id, user.id, {
        status: 'ACCEPTED',
      });
      const pipelineItem = await createPipelineItem(org.id, submission.id);
      const template = await createContractTemplate(org.id);

      // Create contract via admin (bypasses RLS for insert)
      const db = adminDb();
      const [contract] = await db
        .insert(contracts)
        .values({
          organizationId: org.id,
          pipelineItemId: pipelineItem.id,
          contractTemplateId: template.id,
          status: 'DRAFT',
          renderedBody: 'Rendered contract body here',
          mergeData: { author_name: 'Jane Doe', publication: 'Test Mag' },
        })
        .returning();

      // Verify visible in org context
      const fetched = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .select()
          .from(contracts)
          .where(eq(contracts.id, contract.id))
          .limit(1);
        return row;
      });

      expect(fetched).toBeDefined();
      expect(fetched.status).toBe('DRAFT');
      expect(fetched.pipelineItemId).toBe(pipelineItem.id);
    });

    it('transitions contract status DRAFT → SENT', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const submission = await createSubmission(org.id, user.id, {
        status: 'ACCEPTED',
      });
      const pipelineItem = await createPipelineItem(org.id, submission.id);

      const db = adminDb();
      const [contract] = await db
        .insert(contracts)
        .values({
          organizationId: org.id,
          pipelineItemId: pipelineItem.id,
          status: 'DRAFT',
          renderedBody: 'Contract body',
        })
        .returning();

      const updated = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .update(contracts)
          .set({ status: 'SENT', updatedAt: new Date() })
          .where(eq(contracts.id, contract.id))
          .returning();
        return row;
      });

      expect(updated.status).toBe('SENT');
    });

    it('transitions SENT → SIGNED with timestamp', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const submission = await createSubmission(org.id, user.id, {
        status: 'ACCEPTED',
      });
      const pipelineItem = await createPipelineItem(org.id, submission.id);

      const db = adminDb();
      const [contract] = await db
        .insert(contracts)
        .values({
          organizationId: org.id,
          pipelineItemId: pipelineItem.id,
          status: 'SENT',
          renderedBody: 'Contract body',
        })
        .returning();

      const signedAt = new Date();
      const updated = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .update(contracts)
          .set({
            status: 'SIGNED',
            signedAt,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contract.id))
          .returning();
        return row;
      });

      expect(updated.status).toBe('SIGNED');
      expect(updated.signedAt).toBeInstanceOf(Date);
    });

    it('RLS prevents cross-org contract access', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const user = await createUser();
      await createOrgMember(orgA.id, user.id);
      const submission = await createSubmission(orgA.id, user.id, {
        status: 'ACCEPTED',
      });
      const pipelineItem = await createPipelineItem(orgA.id, submission.id);

      const db = adminDb();
      await db.insert(contracts).values({
        organizationId: orgA.id,
        pipelineItemId: pipelineItem.id,
        status: 'DRAFT',
        renderedBody: 'Confidential contract',
      });

      const results = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return tx.select().from(contracts);
      });

      expect(results).toHaveLength(0);
    });
  });
});
