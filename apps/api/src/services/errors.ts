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
