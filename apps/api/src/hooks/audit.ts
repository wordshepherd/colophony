import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { auditService } from '../services/audit.service.js';
import type { AuditLogParams } from '@colophony/types';

type RequestAuditFn = (
  params: Omit<
    AuditLogParams,
    'actorId' | 'organizationId' | 'ipAddress' | 'userAgent'
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

        request.audit = async (params) => {
          await auditService.log(tx, {
            ...params,
            actorId,
            organizationId,
            ipAddress,
            userAgent,
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
