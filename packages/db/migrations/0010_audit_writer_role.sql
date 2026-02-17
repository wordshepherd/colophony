-- Create audit_writer role (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_writer') THEN
    CREATE ROLE audit_writer WITH LOGIN PASSWORD 'audit_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT CONNECT ON DATABASE colophony TO audit_writer;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO audit_writer;
--> statement-breakpoint
GRANT INSERT, SELECT ON "audit_events" TO audit_writer;
--> statement-breakpoint
-- Revoke direct DML from app_user (keep SELECT for admin reads)
REVOKE INSERT, UPDATE, DELETE ON "audit_events" FROM app_user;
--> statement-breakpoint
-- SECURITY DEFINER function for controlled audit inserts
-- Owned by audit_writer (NOSUPERUSER, NOBYPASSRLS) so RLS still applies
-- Follows pattern from 0008_api_keys_rls.sql (verify_api_key, touch_api_key_last_used)
CREATE OR REPLACE FUNCTION insert_audit_event(
  p_action varchar,
  p_resource varchar,
  p_resource_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_ip_address varchar DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_request_id varchar DEFAULT NULL,
  p_method varchar DEFAULT NULL,
  p_route varchar DEFAULT NULL
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_events (
    action, resource, resource_id, actor_id, organization_id,
    old_value, new_value, ip_address, user_agent,
    request_id, method, route
  ) VALUES (
    p_action, p_resource, p_resource_id, p_actor_id, p_organization_id,
    p_old_value, p_new_value, p_ip_address, p_user_agent,
    p_request_id, p_method, p_route
  );
$$;
--> statement-breakpoint
-- Transfer ownership to audit_writer so SECURITY DEFINER runs as audit_writer
-- (not postgres superuser, which would bypass RLS)
ALTER FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar) OWNER TO audit_writer;
--> statement-breakpoint
REVOKE ALL ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar) TO app_user;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar) TO audit_writer;
