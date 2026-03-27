import crypto from 'node:crypto';
import {
  pool,
  organizationInvitations,
  organizations,
  users,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  INVITATION_TOKEN_PREFIX,
  ROLE_DISPLAY_DEFAULTS,
  type Role,
} from '@colophony/types';
import type { ServiceContext, UserServiceContext } from './types.js';
import { emailService } from './email.service.js';
import { enqueueEmail } from '../queues/email.queue.js';
import type { Env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvitationNotFoundError extends Error {
  override name = 'InvitationNotFoundError' as const;
  constructor(message = 'Invitation not found') {
    super(message);
  }
}

export class InvitationExpiredError extends Error {
  override name = 'InvitationExpiredError' as const;
  constructor(message = 'Invitation has expired') {
    super(message);
  }
}

export class InvitationAlreadyAcceptedError extends Error {
  override name = 'InvitationAlreadyAcceptedError' as const;
  constructor(message = 'Invitation has already been accepted') {
    super(message);
  }
}

export class InvitationEmailMismatchError extends Error {
  override name = 'InvitationEmailMismatchError' as const;
  constructor(message = 'Your email does not match the invitation') {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function generateToken(): {
  plainTextToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const randomPart = crypto.randomBytes(16).toString('hex');
  const plainTextToken = `${INVITATION_TOKEN_PREFIX}${randomPart}`;
  const tokenHash = crypto
    .createHash('sha256')
    .update(plainTextToken)
    .digest('hex');
  return { plainTextToken, tokenHash, tokenPrefix: INVITATION_TOKEN_PREFIX };
}

function hashToken(plainText: string): string {
  return crypto.createHash('sha256').update(plainText).digest('hex');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedInvitation {
  id: string;
  organizationId: string;
  email: string;
  roles: Role[];
  status: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  organizationName: string;
}

export interface AcceptResult {
  invitationId: string;
  organizationId: string;
  memberId: string;
  roles: Role[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const invitationService = {
  // -------------------------------------------------------------------------
  // Pure data methods (tx-scoped, RLS-filtered)
  // -------------------------------------------------------------------------

  async create(
    tx: DrizzleDb,
    orgId: string,
    email: string,
    roles: Role[],
    invitedBy: string,
    expiresInDays: number = 7,
  ): Promise<{
    invitation: typeof organizationInvitations.$inferSelect;
    plainTextToken: string;
  }> {
    // Revoke any existing pending invitation for same org+email
    await invitationService.revokeByEmail(tx, orgId, email);

    const { plainTextToken, tokenHash, tokenPrefix } = generateToken();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    const [invitation] = await tx
      .insert(organizationInvitations)
      .values({
        organizationId: orgId,
        email: email.toLowerCase(),
        roles,
        tokenHash,
        tokenPrefix,
        invitedBy,
        expiresAt,
      })
      .returning();

    return { invitation, plainTextToken };
  },

  async listPending(
    tx: DrizzleDb,
    orgId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 50 },
  ) {
    const offset = (pagination.page - 1) * pagination.limit;

    const items = await tx
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        email: organizationInvitations.email,
        roles: sql<string[]>`${organizationInvitations.roles}::text[]`,
        status: organizationInvitations.status,
        tokenPrefix: organizationInvitations.tokenPrefix,
        invitedBy: organizationInvitations.invitedBy,
        expiresAt: organizationInvitations.expiresAt,
        createdAt: organizationInvitations.createdAt,
        inviterEmail: users.email,
      })
      .from(organizationInvitations)
      .leftJoin(users, eq(users.id, organizationInvitations.invitedBy))
      .where(
        and(
          eq(organizationInvitations.organizationId, orgId),
          eq(organizationInvitations.status, 'PENDING'),
        ),
      )
      .orderBy(sql`${organizationInvitations.createdAt} DESC`)
      .limit(pagination.limit)
      .offset(offset);

    return items;
  },

  async revoke(tx: DrizzleDb, orgId: string, invitationId: string) {
    const [updated] = await tx
      .update(organizationInvitations)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.organizationId, orgId),
          eq(organizationInvitations.status, 'PENDING'),
        ),
      )
      .returning();

    if (!updated) {
      throw new InvitationNotFoundError();
    }

    return updated;
  },

  async revokeByEmail(tx: DrizzleDb, orgId: string, email: string) {
    await tx
      .update(organizationInvitations)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(
        and(
          eq(organizationInvitations.organizationId, orgId),
          eq(organizationInvitations.email, email.toLowerCase()),
          eq(organizationInvitations.status, 'PENDING'),
        ),
      );
  },

  async getById(tx: DrizzleDb, orgId: string, invitationId: string) {
    const [invitation] = await tx
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!invitation) {
      throw new InvitationNotFoundError();
    }
    return invitation;
  },

  // -------------------------------------------------------------------------
  // Cross-org methods (SECURITY DEFINER via pool)
  // -------------------------------------------------------------------------

  async verifyToken(
    plainTextToken: string,
  ): Promise<VerifiedInvitation | null> {
    const tokenHash = hashToken(plainTextToken);
    const result = await pool.query<{
      id: string;
      organization_id: string;
      email: string;
      roles: string[];
      status: string;
      invited_by: string;
      expires_at: Date;
      created_at: Date;
      organization_name: string;
    }>('SELECT * FROM verify_invitation_token($1)', [tokenHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      roles: row.roles as Role[],
      status: row.status,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      organizationName: row.organization_name,
    };
  },

  async acceptToken(
    plainTextToken: string,
    userId: string,
    userEmail: string,
  ): Promise<AcceptResult | null> {
    const tokenHash = hashToken(plainTextToken);
    const result = await pool.query<{
      invitation_id: string;
      organization_id: string;
      member_id: string;
      roles: string[];
    }>('SELECT * FROM accept_invitation($1, $2, $3)', [
      tokenHash,
      userId,
      userEmail,
    ]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      invitationId: row.invitation_id,
      organizationId: row.organization_id,
      memberId: row.member_id,
      roles: row.roles as Role[],
    };
  },

  // -------------------------------------------------------------------------
  // Access-aware methods (ServiceContext)
  // -------------------------------------------------------------------------

  async createWithAudit(
    svc: ServiceContext,
    email: string,
    roles: Role[],
    expiresInDays?: number,
  ) {
    const result = await invitationService.create(
      svc.tx,
      svc.actor.orgId,
      email,
      roles,
      svc.actor.userId,
      expiresInDays,
    );
    await svc.audit({
      action: AuditActions.INVITATION_CREATED,
      resource: AuditResources.INVITATION,
      resourceId: result.invitation.id,
      newValue: { email, roles },
    });
    return result;
  },

  async revokeWithAudit(svc: ServiceContext, invitationId: string) {
    const result = await invitationService.revoke(
      svc.tx,
      svc.actor.orgId,
      invitationId,
    );
    await svc.audit({
      action: AuditActions.INVITATION_REVOKED,
      resource: AuditResources.INVITATION,
      resourceId: invitationId,
    });
    return result;
  },

  async acceptWithAudit(
    svc: UserServiceContext,
    plainTextToken: string,
  ): Promise<AcceptResult> {
    // Look up the user email for verification
    const [user] = await svc.tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, svc.userId))
      .limit(1);

    if (!user) {
      throw new InvitationNotFoundError('User not found');
    }

    const result = await invitationService.acceptToken(
      plainTextToken,
      svc.userId,
      user.email,
    );

    if (!result) {
      // Provide more specific error by checking the token
      const verified = await invitationService.verifyToken(plainTextToken);
      if (!verified) throw new InvitationNotFoundError();
      if (verified.status === 'ACCEPTED')
        throw new InvitationAlreadyAcceptedError();
      if (verified.status === 'REVOKED')
        throw new InvitationNotFoundError('Invitation has been revoked');
      if (verified.expiresAt < new Date()) throw new InvitationExpiredError();
      if (verified.email.toLowerCase() !== user.email.toLowerCase())
        throw new InvitationEmailMismatchError();
      throw new InvitationNotFoundError();
    }

    await svc.audit({
      action: AuditActions.INVITATION_ACCEPTED,
      resource: AuditResources.INVITATION,
      resourceId: result.invitationId,
      newValue: { organizationId: result.organizationId },
    });

    return result;
  },

  async resendWithAudit(svc: ServiceContext, invitationId: string, env: Env) {
    // Get the existing invitation
    const existing = await invitationService.getById(
      svc.tx,
      svc.actor.orgId,
      invitationId,
    );

    if (existing.status !== 'PENDING') {
      throw new InvitationNotFoundError('Invitation is not pending');
    }

    // Revoke the old one
    await invitationService.revoke(svc.tx, svc.actor.orgId, invitationId);

    // Create a new one with the same email and roles
    const { invitation, plainTextToken } = await invitationService.create(
      svc.tx,
      svc.actor.orgId,
      existing.email,
      existing.roles,
      svc.actor.userId,
    );

    await svc.audit({
      action: AuditActions.INVITATION_RESENT,
      resource: AuditResources.INVITATION,
      resourceId: invitation.id,
      newValue: { email: existing.email, previousInvitationId: invitationId },
    });

    // Send the invitation email
    await invitationService.sendInvitationEmail(
      svc,
      env,
      invitation,
      plainTextToken,
    );

    return invitation;
  },

  // -------------------------------------------------------------------------
  // Email helper
  // -------------------------------------------------------------------------

  async sendInvitationEmail(
    svc: ServiceContext,
    env: Env,
    invitation: typeof organizationInvitations.$inferSelect,
    plainTextToken: string,
  ) {
    // Resolve org name and inviter email
    const [org] = await svc.tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, svc.actor.orgId))
      .limit(1);

    const [inviter] = await svc.tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, svc.actor.userId))
      .limit(1);

    const orgName = org?.name ?? 'an organization';
    const inviterName = inviter?.email ?? 'An admin';
    // CORS_ORIGIN may be comma-separated for multi-origin deployments; use the first origin
    const webOrigin = env.CORS_ORIGIN.split(',')[0].trim();
    const inviteUrl = `${webOrigin}/invite/accept/${plainTextToken}`;
    const roleNames = invitation.roles
      .map((r) => ROLE_DISPLAY_DEFAULTS[r] ?? r)
      .join(', ');

    const emailSend = await emailService.create(svc.tx, {
      organizationId: svc.actor.orgId,
      recipientEmail: invitation.email,
      templateName: 'organization-invitation',
      eventType: 'invitation.created',
      subject: `You've been invited to join ${orgName}`,
    });

    await enqueueEmail(env, {
      emailSendId: emailSend.id,
      orgId: svc.actor.orgId,
      to: invitation.email,
      from: env.SMTP_FROM ?? env.SENDGRID_FROM ?? 'noreply@colophony.dev',
      templateName: 'organization-invitation',
      templateData: {
        orgName,
        inviterName,
        inviteUrl,
        roleName: roleNames,
        expiresAt: invitation.expiresAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
    });
  },
};
