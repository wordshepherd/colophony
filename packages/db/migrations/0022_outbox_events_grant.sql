-- 0022: Grant INSERT on outbox_events to app_user
-- Services need to insert outbox events within the same RLS transaction
-- to ensure atomicity (event not lost if crash between commit and outbox insert).
-- SELECT is not granted — only the superuser outbox poller reads/updates events.

GRANT INSERT ON "outbox_events" TO app_user;
