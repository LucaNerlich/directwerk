-- Email delivery claims are now provisional: the row is inserted before the send and only
-- finalized (sent_at) after the transport call succeeds. A stale provisional claim (sent_at
-- NULL, delivered_at older than the lease) can be taken over so a crash between claim and
-- send no longer loses the email permanently.
ALTER TABLE email_deliveries
    ADD COLUMN sent_at TIMESTAMPTZ;

-- Rows written before this migration are completed deliveries; finalize them so they are not
-- mistaken for crashed provisional claims and re-sent.
UPDATE email_deliveries
SET sent_at = delivered_at
WHERE sent_at IS NULL;
