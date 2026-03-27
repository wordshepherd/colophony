-- Organization invitations with token-based email invitation flow
-- Allows admins to invite users by email even if they don't have an account yet

--> statement-breakpoint
CREATE TYPE "public"."InvitationStatus" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

--> statement-breakpoint
CREATE TABLE "organization_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "roles" "Role"[] NOT NULL DEFAULT ARRAY['READER']::"Role"[],
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "token_prefix" varchar(16) NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_org_email_pending_idx"
  ON "organization_invitations" ("organization_id", "email")
  WHERE status = 'PENDING';

--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_id_idx"
  ON "organization_invitations" ("organization_id");

--> statement-breakpoint
CREATE INDEX "organization_invitations_token_hash_idx"
  ON "organization_invitations" ("token_hash");

--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx"
  ON "organization_invitations" ("email");

--> statement-breakpoint
ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "organization_invitations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "organization_invitations_org_isolation"
  ON "organization_invitations"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "organization_invitations" TO app_user;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION verify_invitation_token(p_token_hash varchar)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  email varchar,
  roles text[],
  status "InvitationStatus",
  invited_by uuid,
  expires_at timestamptz,
  created_at timestamptz,
  organization_name varchar
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.id,
    oi.organization_id,
    oi.email,
    oi.roles::text[],
    oi.status,
    oi.invited_by,
    oi.expires_at,
    oi.created_at,
    o.name AS organization_name
  FROM public.organization_invitations oi
  JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.token_hash = p_token_hash
$$;

--> statement-breakpoint
REVOKE ALL ON FUNCTION verify_invitation_token(varchar) FROM PUBLIC;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION verify_invitation_token(varchar) TO app_user;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token_hash varchar,
  p_user_id uuid,
  p_user_email varchar
)
RETURNS TABLE(
  invitation_id uuid,
  organization_id uuid,
  member_id uuid,
  roles text[]
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_member_id uuid;
BEGIN
  -- Lock and validate the invitation
  SELECT * INTO v_inv
  FROM public.organization_invitations
  WHERE token_hash = p_token_hash
    AND status = 'PENDING'
    AND expires_at > now()
    AND lower(email) = lower(p_user_email)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Mark as accepted
  UPDATE public.organization_invitations
  SET status = 'ACCEPTED',
      accepted_by = p_user_id,
      accepted_at = now()
  WHERE id = v_inv.id;

  -- Create membership (ON CONFLICT for idempotency)
  INSERT INTO public.organization_members (organization_id, user_id, roles)
  VALUES (v_inv.organization_id, p_user_id, v_inv.roles)
  ON CONFLICT (organization_id, user_id) DO NOTHING
  RETURNING id INTO v_member_id;

  -- If member already existed, get the existing ID
  IF v_member_id IS NULL THEN
    SELECT om.id INTO v_member_id
    FROM public.organization_members om
    WHERE om.organization_id = v_inv.organization_id
      AND om.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_inv.id, v_inv.organization_id, v_member_id, v_inv.roles::text[];
END;
$$;

--> statement-breakpoint
REVOKE ALL ON FUNCTION accept_invitation(varchar, uuid, varchar) FROM PUBLIC;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION accept_invitation(varchar, uuid, varchar) TO app_user;
