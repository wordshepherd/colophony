ALTER TABLE "submissions" ADD COLUMN "status_token_expires_at" timestamptz;
--> statement-breakpoint
-- DROP required: return type changed (added token_expired boolean).
-- PostgreSQL does not allow CREATE OR REPLACE to change return type.
DROP FUNCTION IF EXISTS verify_status_token(varchar);
--> statement-breakpoint
-- SECURITY DEFINER: intentional. Token-based lookup must bypass RLS because
-- embed submitters have no session/org context. Access is gated by knowledge
-- of the SHA-256 token hash. Rollback-safe: column is nullable with no default.
CREATE FUNCTION verify_status_token(p_token_hash varchar)
RETURNS TABLE(
  submission_id uuid, submission_title varchar,
  submission_status text, submitted_at timestamptz,
  organization_name varchar, period_name varchar,
  token_expired boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.title, s.status::text, s.submitted_at, o.name, sp.name,
    CASE WHEN s.status_token_expires_at IS NOT NULL
         AND s.status_token_expires_at < NOW()
    THEN true ELSE false END
  FROM public.submissions s
  JOIN public.organizations o ON o.id = s.organization_id
  LEFT JOIN public.submission_periods sp ON sp.id = s.submission_period_id
  WHERE s.status_token_hash = p_token_hash
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION verify_status_token(varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION verify_status_token(varchar) TO app_user;
