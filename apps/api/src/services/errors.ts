/**
 * Shared domain errors for the service layer.
 *
 * Each API surface maps these to its own error format:
 * - tRPC: ForbiddenError → TRPCError({ code: 'FORBIDDEN' })
 * - REST: ForbiddenError → 403 response
 * - GraphQL: ForbiddenError → GraphQL error with FORBIDDEN extension
 */

export class ForbiddenError extends Error {
  override name = 'ForbiddenError' as const;

  constructor(message = 'Forbidden') {
    super(message);
  }
}

export class NotFoundError extends Error {
  override name = 'NotFoundError' as const;

  constructor(message = 'Not found') {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Access-control helpers — shared across service methods
// ---------------------------------------------------------------------------

/**
 * Assert the caller is the resource owner, or has EDITOR/ADMIN role.
 * Throws {@link ForbiddenError} if neither condition is met.
 */
export function assertOwnerOrEditor(
  actorUserId: string,
  actorRole: string,
  resourceOwnerId: string | null,
): void {
  if (
    resourceOwnerId !== actorUserId &&
    actorRole !== 'ADMIN' &&
    actorRole !== 'EDITOR'
  ) {
    throw new ForbiddenError('You do not have access to this submission');
  }
}

/**
 * Assert the caller has EDITOR or ADMIN role.
 * Throws {@link ForbiddenError} if the role is insufficient.
 */
export function assertEditorOrAdmin(role: string): void {
  if (role !== 'ADMIN' && role !== 'EDITOR') {
    throw new ForbiddenError('Editor or admin role required');
  }
}
