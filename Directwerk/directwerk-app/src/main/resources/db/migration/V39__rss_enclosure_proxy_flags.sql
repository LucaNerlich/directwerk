-- Stable RSS enclosure proxies: feed-level and episode-level kill switches.
ALTER TABLE subscriber_feeds
    ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE episodes
    ADD COLUMN enclosure_enabled BOOLEAN NOT NULL DEFAULT TRUE;
