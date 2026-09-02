-- Apple Podcasts requires an explicit-content flag on the channel; series-level setting
-- feeds the RSS channel `itunes:explicit` tag (false = clean by default).
ALTER TABLE podcast_series
    ADD COLUMN itunes_explicit BOOLEAN NOT NULL DEFAULT FALSE;
