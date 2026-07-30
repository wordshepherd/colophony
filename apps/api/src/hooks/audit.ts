import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  auditService,
  principalFromAuthContext,
} from '../services/audit.service.js';
import type { AuditLogParams } from '@colophony/types';

type RequestAuditFn = (
  params: Omit<
    AuditLogParams,
    | 'actorId'
    | 'organizationId'
    | 'ipAddress'
    | 'userAgent'
    | 'principalId'
    | 'principalType'
  >,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyRequest {
    audit: RequestAuditFn;
  }
}

const noop: RequestAuditFn = async () => {};

export default fp(
  async function auditPlugin(app: FastifyInstance) {
    app.decorateRequest('audit', noop);

    app.addHook(
      'onRequest',
      async function auditOnRequest(request: FastifyRequest) {
        if (!request.dbTx) {
          // No transaction — provide a no-op that warns only when called
          request.audit = async () => {
            request.log.warn(
              'audit.log called without a database transaction (dbTx is null)',
            );
          };
          return;
        }

        const tx = request.dbTx;
        const actorId = request.authContext?.userId;
        const organizationId = request.authContext?.orgId;
        const ipAddress = request.ip;
        const userAgent = request.headers['user-agent'];
        const requestId = String(request.id);
        const method = request.method;
        const route = request.routeOptions?.url ?? request.url.split('?')[0];
        // The acting credential, distinct from actorId. Must stay identical to
        // the fallback path in hooks/fastify-guards.ts — rows from either are
        // meant to be indistinguishable.
        const { principalId, principalType } = principalFromAuthContext(
          request.authContext,
        );

        request.audit = async (params) => {
          await auditService.log(tx, {
            ...params,
            actorId,
            organizationId,
            ipAddress,
            userAgent,
            requestId,
            method,
            route,
            principalId,
            principalType,
          } as AuditLogParams);
        };
      },
    );
  },
  {
    name: 'colophony-audit',
    dependencies: ['colophony-db-context'],
    fastify: '5.x',
  },
);
