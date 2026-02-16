import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '@colophony/db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

        // API key auth pre-sets orgId — resolve role from membership, fail closed
        if (
          request.authContext.orgId &&
          request.authContext.authMethod === 'apikey'
        ) {
          const client = await pool.connect();
          let role: string | undefined;
          try {
            await client.query('BEGIN READ ONLY');
            await client.query('SELECT set_config($1, $2, true)', [
              'app.current_org',
              request.authContext.orgId,
            ]);
            await client.query('SELECT set_config($1, $2, true)', [
              'app.user_id',
              request.authContext.userId,
            ]);
            const memberResult = await client.query<{ role: string }>(
              'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
              [request.authContext.orgId, request.authContext.userId],
            );
            if (memberResult.rows.length > 0) {
              role = memberResult.rows[0].role;
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            client.release();
          }

          if (!role) {
            return reply.status(403).send({
              error: 'not_a_member',
              message:
                'API key creator is no longer a member of this organization',
            });
          }
          request.authContext.role = role as 'ADMIN' | 'EDITOR' | 'READER';
          return;
        }

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
        // organizations table has NO RLS — direct pool query is safe
        const orgResult = await pool.query(
          'SELECT id FROM organizations WHERE id = $1',
          [orgIdHeader],
        );

        if (orgResult.rows.length === 0) {
          return reply.status(400).send({
            error: 'invalid_org',
            message: 'Organization not found',
          });
        }

        // Verify membership using RLS-native bootstrap:
        // Acquire a short-lived read-only transaction, set the org context so
        // RLS passes, then query organization_members filtering by user_id.
        //
        // TOCTOU note: There is a narrow window between this bootstrap check
        // and the main request transaction (db-context hook) where a membership
        // revocation could theoretically be missed, permitting one stale
        // authorized request. This is the same class of race as token
        // revocation mid-request and is acceptable.
        const client = await pool.connect();
        let role: string | undefined;
        try {
          await client.query('BEGIN READ ONLY');
          await client.query('SELECT set_config($1, $2, true)', [
            'app.current_org',
            orgIdHeader,
          ]);
          await client.query('SELECT set_config($1, $2, true)', [
            'app.user_id',
            request.authContext.userId,
          ]);
          const memberResult = await client.query<{ role: string }>(
            'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
            [orgIdHeader, request.authContext.userId],
          );
          if (memberResult.rows.length > 0) {
            role = memberResult.rows[0].role;
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          // Rethrow DB errors — don't mask infrastructure failures as 403s
          throw err;
        } finally {
          client.release();
        }

        if (!role) {
          return reply.status(403).send({
            error: 'not_a_member',
            message: 'You are not a member of this organization',
          });
        }

        request.authContext.orgId = orgIdHeader;
        request.authContext.role = role as 'ADMIN' | 'EDITOR' | 'READER';
      },
    );
  },
  {
    name: 'colophony-org-context',
    dependencies: ['colophony-auth'],
    fastify: '5.x',
  },
);
