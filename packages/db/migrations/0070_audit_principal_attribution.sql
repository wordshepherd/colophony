-- Distinguish the acting credential from the effective user in audit_events.
--
-- Before this, an API key's actions and the actions of the human who minted it
-- were recorded identically: hooks/auth.ts sets userId = creator.id for
-- authMethod 'apikey', so actor_id is the creator either way.
--
-- actor_id keeps meaning "the effective user". principal_id/principal_type
-- record "the acting credential":
--   direct human                    -> principal_id NULL,  actor_id = the human
--   org API key                     -> principal_id = key, actor_id = creator
--   instance principal (future)     -> principal_id set,   actor_id NULL
--   instance principal acting-as    -> principal_id set,   actor_id = target user
--
-- No backfill: NULL correctly means "we do not know", which is true of every
-- historical row.
--
-- principal_id carries NO foreign key on purpose. It is polymorphic —
-- api_keys.id today, service_principals.id once that lands — so no single FK is
-- expressible. A dangling id after key deletion is the correct outcome for an
-- audit log: the record of what happened must outlive the credential.
ALTER TABLE "audit_events" ADD COLUMN "principal_id" uuid;
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "principal_type" varchar(32);
--> statement-breakpoint
CREATE INDEX "audit_events_principal_created_idx" ON "audit_events" ("principal_id","created_at");
--> statement-breakpoint
-- DROP is REQUIRED here, and not for the usual reason.
--
-- The familiar trap — the one migrations 0047, 0055 and 0060 each hit — is that
-- CREATE OR REPLACE cannot change a return type. That is not this:
-- insert_audit_event returns void and always will.
--
-- The hazard is that a changed PARAMETER LIST makes a new *overload* rather than
-- a replacement. CREATE OR REPLACE with 14 args would leave the 12-arg function
-- standing, and the new one would be owned by whoever runs migrations (the
-- superuser 'colophony') with EXECUTE granted to PUBLIC by default — a
-- SECURITY DEFINER function running as superuser, i.e. one that bypasses RLS.
-- That is precisely what the ownership transfer below exists to prevent, and it
-- would be silently reintroduced.
--
-- So: drop the old signature, create the new one, then re-apply ownership and
-- grants against the new 14-type signature. Verified by
-- rls-infrastructure.test.ts, which asserts exactly one insert_audit_event
-- exists, owned by audit_writer, with no PUBLIC EXECUTE.
DROP FUNCTION IF EXISTS insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar);
--> statement-breakpoint
-- The two new params go LAST with DEFAULT NULL so every existing 12-positional
-- caller (gdpr.service.ts, and a 2-arg call in rls-no-context.test.ts) keeps
-- binding without edits.
CREATE FUNCTION insert_audit_event(
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
  p_route varchar DEFAULT NULL,
  p_principal_id uuid DEFAULT NULL,
  p_principal_type varchar DEFAULT NULL
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_events (
    action, resource, resource_id, actor_id, organization_id,
    old_value, new_value, ip_address, user_agent,
    request_id, method, route,
    principal_id, principal_type
  ) VALUES (
    p_action, p_resource, p_resource_id, p_actor_id, p_organization_id,
    p_old_value, p_new_value, p_ip_address, p_user_agent,
    p_request_id, p_method, p_route,
    p_principal_id, p_principal_type
  );
$$;
--> statement-breakpoint
-- Transfer ownership to audit_writer so SECURITY DEFINER runs as audit_writer
-- (not postgres superuser, which would bypass RLS)
ALTER FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar, uuid, varchar) OWNER TO audit_writer;
--> statement-breakpoint
REVOKE ALL ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar, uuid, varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar, uuid, varchar) TO app_user;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar, uuid, varchar) TO audit_writer;
