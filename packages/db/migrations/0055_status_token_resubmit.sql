-- Extend verify_status_token() to also return organization_id and submitter_id.
-- DROP required: return type changed (added two columns).
DROP FUNCTION IF EXISTS verify_status_token(varchar);
--> statement-breakpoint
CREATE FUNCTION verify_status_token(p_token_hash varchar)
RETURNS TABLE(
  submission_id uuid, submission_title varchar,
  submission_status text, submitted_at timestamptz,
  organization_name varchar, period_name varchar,
  token_expired boolean,
  organization_id uuid, submitter_id uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.title, s.status::text, s.submitted_at, o.name, sp.name,
    CASE WHEN s.status_token_expires_at IS NOT NULL
         AND s.status_token_expires_at < NOW()
    THEN true ELSE false END,
    s.organization_id, s.submitter_id
  FROM public.submissions s
  JOIN public.organizations o ON o.id = s.organization_id
  LEFT JOIN public.submission_periods sp ON sp.id = s.submission_period_id
  WHERE s.status_token_hash = p_token_hash
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION verify_status_token(varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION verify_status_token(varchar) TO app_user;
--> statement-breakpoint
-- get_resubmit_context(): returns submission context for R&R resubmissions.
-- Only returns data if status is REVISE_AND_RESUBMIT and token is valid + not expired.
-- SECURITY DEFINER: intentional — same rationale as verify_status_token().
CREATE FUNCTION get_resubmit_context(p_token_hash varchar)
RETURNS TABLE(
  submission_id uuid, submission_title varchar,
  organization_id uuid, organization_name varchar,
  submitter_id uuid, revision_notes text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.title, s.organization_id, o.name, s.submitter_id,
    (
      SELECT sh.comment
      FROM public.submission_history sh
      WHERE sh.submission_id = s.id
        AND sh.to_status = 'REVISE_AND_RESUBMIT'
      ORDER BY sh.changed_at DESC
      LIMIT 1
    )
  FROM public.submissions s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.status_token_hash = p_token_hash
    AND s.status::text = 'REVISE_AND_RESUBMIT'
    AND (s.status_token_expires_at IS NULL OR s.status_token_expires_at >= NOW())
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION get_resubmit_context(varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION get_resubmit_context(varchar) TO app_user;
