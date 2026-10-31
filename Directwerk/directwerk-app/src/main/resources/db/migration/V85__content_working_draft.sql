-- Working draft overlay for published articles/episodes (draft-over-publish).
-- Live columns stay public while editors stage changes in working_draft JSON.
ALTER TABLE articles
    ADD COLUMN working_draft jsonb NULL;

ALTER TABLE episodes
    ADD COLUMN working_draft jsonb NULL;
