-- journal_directory: SELECT-only for app_user (writes via superuser pool)
REVOKE INSERT, UPDATE, DELETE ON "journal_directory" FROM app_user;

-- audit_events: SELECT-only for app_user (writes via insert_audit_event() SECURITY DEFINER)
REVOKE INSERT, UPDATE, DELETE ON "audit_events" FROM app_user;
