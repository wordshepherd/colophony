import { Request } from 'express';
import { prisma, PrismaTransaction } from '@prospector/db';
import type { AuthContext } from '@prospector/types';
import { trpcRegistry } from './trpc.registry';

export interface TRPCContext {
  req: Request;
  user: AuthContext | null;
  org: { id: string; role: 'ADMIN' | 'EDITOR' | 'READER' } | null;
  prisma: typeof prisma | PrismaTransaction;
}

export interface AuthedContext extends TRPCContext {
  user: AuthContext;
}

export interface OrgContext extends AuthedContext {
  org: { id: string; role: 'ADMIN' | 'EDITOR' | 'READER' };
  prisma: PrismaTransaction;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Creates the tRPC context from the incoming request.
 * Extracts JWT from Authorization header and populates user context.
 * Organization context is populated based on the x-organization-id header.
 */
export async function createContext(req: Request): Promise<TRPCContext> {
  let user: AuthContext | null = null;
  let org: TRPCContext['org'] = null;

  // Extract and verify JWT
  const token = extractBearerToken(req);
  if (token) {
    try {
      const payload = trpcRegistry.authService.verifyAccessToken(token);
      if (payload) {
        user = {
          userId: payload.sub,
          email: payload.email,
        };

        // Extract organization context from header
        const orgId = req.headers['x-organization-id'] as string | undefined;
        if (orgId && user) {
          // Look up user's role in this organization
          const membership = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: orgId,
                userId: user.userId,
              },
            },
          });

          if (membership) {
            org = {
              id: orgId,
              role: membership.role as 'ADMIN' | 'EDITOR' | 'READER',
            };
            user.orgId = orgId;
            user.role = membership.role as 'ADMIN' | 'EDITOR' | 'READER';
          }
        }
      }
    } catch {
      // Invalid token, user remains null
    }
  }

  return {
    req,
    user,
    org,
    prisma,
  };
}

export type Context = TRPCContext;
