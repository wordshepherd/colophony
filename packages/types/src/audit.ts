// ---------------------------------------------------------------------------
// Audit logging — shared constants and typed params
// ---------------------------------------------------------------------------

/** Audit action constants. */
export const AuditActions = {
  // User lifecycle (synced from Zitadel webhooks)
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_REACTIVATED: "USER_REACTIVATED",
  USER_REMOVED: "USER_REMOVED",
  USER_EMAIL_VERIFIED: "USER_EMAIL_VERIFIED",

  // Organization lifecycle
  ORG_CREATED: "ORG_CREATED",
  ORG_UPDATED: "ORG_UPDATED",
  ORG_DELETED: "ORG_DELETED",
  ORG_MEMBER_ADDED: "ORG_MEMBER_ADDED",
  ORG_MEMBER_REMOVED: "ORG_MEMBER_REMOVED",
  ORG_MEMBER_ROLE_CHANGED: "ORG_MEMBER_ROLE_CHANGED",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

/** Audit resource constants. */
export const AuditResources = {
  USER: "user",
  ORGANIZATION: "organization",
} as const;

export type AuditResource =
  (typeof AuditResources)[keyof typeof AuditResources];

// ---------------------------------------------------------------------------
// Discriminated union — enforces valid action↔resource pairs
// ---------------------------------------------------------------------------

interface BaseAuditParams {
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.USER;
  action:
    | typeof AuditActions.USER_CREATED
    | typeof AuditActions.USER_UPDATED
    | typeof AuditActions.USER_DEACTIVATED
    | typeof AuditActions.USER_REACTIVATED
    | typeof AuditActions.USER_REMOVED
    | typeof AuditActions.USER_EMAIL_VERIFIED;
}

export interface OrgAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.ORGANIZATION;
  action:
    | typeof AuditActions.ORG_CREATED
    | typeof AuditActions.ORG_UPDATED
    | typeof AuditActions.ORG_DELETED
    | typeof AuditActions.ORG_MEMBER_ADDED
    | typeof AuditActions.ORG_MEMBER_REMOVED
    | typeof AuditActions.ORG_MEMBER_ROLE_CHANGED;
}

/** Union of all resource-specific param types. */
export type AuditLogParams = UserAuditParams | OrgAuditParams;
