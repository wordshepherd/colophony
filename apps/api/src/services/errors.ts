/**
 * Shared domain errors for the service layer.
 *
 * Each API surface maps these to its own error format:
 * - tRPC: ForbiddenError → TRPCError({ code: 'FORBIDDEN' })
 * - REST: ForbiddenError → 403 response
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
  actorRoles: readonly string[],
  resourceOwnerId: string | null,
): void {
  if (
    resourceOwnerId !== actorUserId &&
    !actorRoles.some((r) => ['ADMIN', 'EDITOR'].includes(r))
  ) {
    throw new ForbiddenError('You do not have access to this submission');
  }
}

/**
 * Assert the caller has EDITOR or ADMIN role.
 * Throws {@link ForbiddenError} if the roles are insufficient.
 */
export function assertEditorOrAdmin(roles: readonly string[]): void {
  if (!roles.some((r) => ['EDITOR', 'ADMIN'].includes(r))) {
    throw new ForbiddenError('Editor or admin role required');
  }
}

/**
 * Assert the caller has EDITOR, PRODUCTION, or ADMIN role.
 * Throws {@link ForbiddenError} if the roles are insufficient.
 */
export function assertEditorOrProductionOrAdmin(
  roles: readonly string[],
): void {
  if (!roles.some((r) => ['EDITOR', 'PRODUCTION', 'ADMIN'].includes(r))) {
    throw new ForbiddenError('Editor, production, or admin role required');
  }
}

/**
 * Assert the caller has BUSINESS_OPS or ADMIN role.
 * Throws {@link ForbiddenError} if the roles are insufficient.
 */
export function assertBusinessOpsOrAdmin(roles: readonly string[]): void {
  if (!roles.some((r) => ['BUSINESS_OPS', 'ADMIN'].includes(r))) {
    throw new ForbiddenError('Business Operations or admin role required');
  }
}
