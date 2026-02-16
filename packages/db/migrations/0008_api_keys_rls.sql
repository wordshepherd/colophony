-- FORCE ROW LEVEL SECURITY (Drizzle only generates ENABLE, not FORCE)
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "api_keys" TO app_user;

-- SECURITY DEFINER function: cross-org API key lookup by hash
-- Same hardening pattern as list_user_organizations (0005_membership_helpers.sql)
CREATE OR REPLACE FUNCTION verify_api_key(p_key_hash varchar)
RETURNS TABLE(
  id uuid, organization_id uuid, created_by uuid, name varchar,
  scopes jsonb, expires_at timestamptz, revoked_at timestamptz,
  last_used_at timestamptz, created_at timestamptz,
  creator_email varchar, creator_email_verified boolean,
  creator_deleted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ak.id, ak.organization_id, ak.created_by, ak.name,
         ak.scopes, ak.expires_at, ak.revoked_at,
         ak.last_used_at, ak.created_at,
         u.email, u.email_verified, u.deleted_at
  FROM public.api_keys ak
  JOIN public.users u ON u.id = ak.created_by
  WHERE ak.key_hash = p_key_hash
$$;

REVOKE ALL ON FUNCTION verify_api_key(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_api_key(varchar) TO app_user;

-- SECURITY DEFINER function: fire-and-forget lastUsedAt update
CREATE OR REPLACE FUNCTION touch_api_key_last_used(p_key_id uuid, p_ts timestamptz)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys SET last_used_at = p_ts WHERE id = p_key_id;
$$;

REVOKE ALL ON FUNCTION touch_api_key_last_used(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION touch_api_key_last_used(uuid, timestamptz) TO app_user;
