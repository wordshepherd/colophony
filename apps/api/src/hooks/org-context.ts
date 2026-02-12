import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, eq, and, organizations, organizationMembers } from '@colophony/db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default fp(
  async function orgContextPlugin(app: FastifyInstance) {
    app.addHook(
      'onRequest',
      async function orgContextHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        // Must run after auth hook — skip if no auth context
        if (!request.authContext) return;

        const orgIdHeader = request.headers['x-organization-id'] as
          | string
          | undefined;

        // No org header — routes decide if org context is required
        if (!orgIdHeader) return;

        // Validate UUID format
        if (!UUID_RE.test(orgIdHeader)) {
          return reply.status(400).send({
            error: 'invalid_org',
            message: 'X-Organization-Id must be a valid UUID',
          });
        }

        // Verify org exists
        // SECURITY NOTE: This query uses `db` (pool as superuser) which bypasses RLS.
        // This is correct — we can't use RLS to determine the RLS context.
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, orgIdHeader),
        });

        if (!org) {
          return reply.status(400).send({
            error: 'invalid_org',
            message: 'Organization not found',
          });
        }

        // Verify membership
        // SECURITY NOTE: Uses `db` (bypasses RLS) — necessary to check membership
        // before RLS context is established.
        const membership = await db.query.organizationMembers.findFirst({
          where: and(
            eq(organizationMembers.organizationId, orgIdHeader),
            eq(organizationMembers.userId, request.authContext.userId),
          ),
        });

        if (!membership) {
          return reply.status(403).send({
            error: 'not_a_member',
            message: 'You are not a member of this organization',
          });
        }

        request.authContext.orgId = orgIdHeader;
        request.authContext.role = membership.role;
      },
    );
  },
  {
    name: 'colophony-org-context',
    dependencies: ['colophony-auth'],
    fastify: '5.x',
  },
);
