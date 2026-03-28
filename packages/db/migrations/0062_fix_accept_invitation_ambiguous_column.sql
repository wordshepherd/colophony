-- Fix: "column reference organization_id is ambiguous" in accept_invitation()
--
-- The RETURNS TABLE(organization_id uuid, ...) creates OUT parameters that
-- shadow the organization_members.organization_id column in PL/pgSQL.
-- Adding #variable_conflict use_column tells PL/pgSQL to prefer column names.

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
#variable_conflict use_column
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
