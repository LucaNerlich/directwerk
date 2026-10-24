-- #717: invalidating a snapshot must be durable. Deleting the presence row made
-- the store "heal" it from the still-present object and redirect readers to XML
-- built under the old, broader entitlement.
ALTER TABLE rss_snapshot_presence
    ADD COLUMN stale BOOLEAN NOT NULL DEFAULT false;
