import { z } from 'zod';
import {
  updateFederationConfigSchema,
  domainParamSchema,
  initiateTrustSchema,
  peerActionSchema,
} from '@colophony/types';
import { internalAdminProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { federationService } from '../../services/federation.service.js';
import { trustService } from '../../services/trust.service.js';
import { validateEnv } from '../../config/env.js';

export const federationRouter = createRouter({
  getConfig: internalAdminProcedure.query(async () => {
    try {
      const env = validateEnv();
      return await federationService.getPublicConfig(env);
    } catch (error) {
      mapServiceError(error);
    }
  }),

  updateConfig: internalAdminProcedure
    .input(updateFederationConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const actorId = ctx.authContext.userId;
        return await federationService.updateConfig(env, input, actorId);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  previewRemote: internalAdminProcedure
    .input(domainParamSchema)
    .query(async ({ input }) => {
      try {
        return await trustService.fetchRemoteMetadata(input.domain);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  listPeers: internalAdminProcedure.query(async ({ ctx }) => {
    try {
      const orgId = ctx.authContext.orgId;
      return await trustService.listPeers(orgId);
    } catch (error) {
      mapServiceError(error);
    }
  }),

  getPeer: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await trustService.getPeerById(orgId, input.id);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  initiateTrust: internalAdminProcedure
    .input(initiateTrustSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const orgId = ctx.authContext.orgId;
        const actorId = ctx.authContext.userId;
        return await trustService.initiateTrust(env, orgId, input, actorId);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  acceptPeer: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }).merge(peerActionSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const orgId = ctx.authContext.orgId;
        const actorId = ctx.authContext.userId;
        const { id, ...action } = input;
        return await trustService.acceptInboundTrust(
          env,
          orgId,
          id,
          action,
          actorId,
        );
      } catch (error) {
        mapServiceError(error);
      }
    }),

  rejectPeer: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        const actorId = ctx.authContext.userId;
        return await trustService.rejectTrust(orgId, input.id, actorId);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  revokePeer: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        const actorId = ctx.authContext.userId;
        return await trustService.revokeTrust(orgId, input.id, actorId);
      } catch (error) {
        mapServiceError(error);
      }
    }),
});
