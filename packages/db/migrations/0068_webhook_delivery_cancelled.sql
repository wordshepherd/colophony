-- 0068: Add CANCELLED to WebhookDeliveryStatus
--
-- The delivery worker re-reads the endpoint immediately before every send. When the
-- endpoint has been disabled, or no longer subscribes to the event, the queued delivery
-- is marked CANCELLED instead of being sent.
--
-- CANCELLED rather than FAILED deliberately: countRecentFailures() counts FAILED rows over
-- a 24h window and feeds the auto-disable threshold, so recording a cancellation as a
-- failure would push an endpoint further toward being disabled for declining to send.

-- Keep this as the only statement in the file. ALTER TYPE ... ADD VALUE may run inside a
-- transaction on PG12+, but the new value cannot be *used* until that transaction commits,
-- and drizzle wraps each migration in one.
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
