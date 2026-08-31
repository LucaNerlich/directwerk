-- Article feeds reuse the podcast RSS snapshot presence/stale-prefix tables (they are
-- already schema-generic: tenant_id + opaque kind + subject_id). Distinct kind literals
-- for articles make collisions with podcast's TENANT/SERIES/PRIVATE_FEED rows structurally
-- impossible without any change to the primary key shape.

ALTER TABLE rss_snapshot_presence
    DROP CONSTRAINT rss_snapshot_presence_kind_check;

ALTER TABLE rss_snapshot_presence
    ADD CONSTRAINT rss_snapshot_presence_kind_check
    CHECK (kind IN ('TENANT', 'SERIES', 'PRIVATE_FEED', 'ARTICLE_TENANT', 'ARTICLE_PRIVATE_FEED'));

ALTER TABLE rss_snapshot_presence
    DROP CONSTRAINT rss_snapshot_presence_subject_check;

ALTER TABLE rss_snapshot_presence
    ADD CONSTRAINT rss_snapshot_presence_subject_check
    CHECK (
        (kind IN ('TENANT', 'ARTICLE_TENANT') AND subject_id = 0)
        OR (kind NOT IN ('TENANT', 'ARTICLE_TENANT') AND subject_id > 0)
    );
