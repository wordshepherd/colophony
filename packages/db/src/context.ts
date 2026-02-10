import { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "./client";

/**
 * Transaction client type - same as PrismaClient but without transaction methods
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Validate UUID format to prevent SQL injection
 */
function validateUuid(id: string, name: string): void {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error(`Invalid UUID format for ${name}`);
  }
}

/**
 * Execute a function within an organization context with Row-Level Security.
 *
 * CRITICAL: This uses SET LOCAL which is transaction-scoped.
 * The RLS context is automatically cleared when the transaction ends.
 *
 * @param orgId - The organization ID to set as context
 * @param userId - The user ID to set as context
 * @param fn - The function to execute within the transaction
 * @param prismaClient - Optional PrismaClient to use (defaults to singleton)
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const submissions = await withOrgContext(orgId, userId, async (tx) => {
 *   return tx.submission.findMany();
 * });
 * ```
 */
export async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<T> {
  // Validate UUIDs to prevent SQL injection
  validateUuid(orgId, "orgId");
  validateUuid(userId, "userId");

  return prismaClient.$transaction(async (tx) => {
    // CRITICAL: Use SET LOCAL, not SET
    // SET LOCAL is transaction-scoped and automatically cleared
    // SET would leak context across connections in a pool
    // Note: We use $executeRawUnsafe because SET LOCAL doesn't support parameterized queries
    // UUIDs are validated above to prevent SQL injection
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org = '${orgId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
    return fn(tx);
  });
}

/**
 * Execute a function within a user context only (no organization).
 * Useful for user-level operations that span organizations.
 *
 * @param userId - The user ID to set as context
 * @param fn - The function to execute within the transaction
 * @param prismaClient - Optional PrismaClient to use (defaults to singleton)
 * @returns The result of the function
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<T> {
  // Validate UUID to prevent SQL injection
  validateUuid(userId, "userId");

  return prismaClient.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
    return fn(tx);
  });
}

/**
 * Create context helpers bound to a specific PrismaClient.
 * Useful for testing with a different client (e.g., non-superuser for RLS enforcement).
 *
 * @param prismaClient - The PrismaClient to bind to
 * @returns Object with withOrgContext and withUserContext bound to the client
 *
 * @example
 * ```typescript
 * const { withOrgContext: testOrgContext } = createContextHelpers(appPrisma);
 * const submissions = await testOrgContext(orgId, userId, async (tx) => {
 *   return tx.submission.findMany();
 * });
 * ```
 */
export function createContextHelpers(prismaClient: PrismaClient) {
  return {
    withOrgContext: <T>(
      orgId: string,
      userId: string,
      fn: (tx: PrismaTransaction) => Promise<T>,
    ) => withOrgContext(orgId, userId, fn, prismaClient),

    withUserContext: <T>(
      userId: string,
      fn: (tx: PrismaTransaction) => Promise<T>,
    ) => withUserContext(userId, fn, prismaClient),
  };
}
