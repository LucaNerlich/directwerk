CREATE TABLE podcast_series (
    id                                  BIGSERIAL PRIMARY KEY,
    tenant_id                           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug                                VARCHAR(64) NOT NULL,
    title                               VARCHAR(255) NOT NULL,
    description                         TEXT,
    cover_asset_id                      BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    language                            VARCHAR(8) NOT NULL DEFAULT 'de',
    itunes_category                     VARCHAR(128),
    default_required_level_sort_order   INT,
    status                              VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_podcast_series_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT chk_podcast_series_default_level CHECK (
        default_required_level_sort_order IS NULL OR default_required_level_sort_order >= 0
    ),
    CONSTRAINT uq_podcast_series_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_podcast_series_tenant_id ON podcast_series(tenant_id);
CREATE INDEX idx_podcast_series_tenant_status ON podcast_series(tenant_id, status);

CREATE TABLE formats (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug                        VARCHAR(64) NOT NULL,
    name                        VARCHAR(255) NOT NULL,
    description                 TEXT,
    required_level_sort_order   INT,
    sort_order                  INT NOT NULL DEFAULT 0,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_formats_required_level CHECK (
        required_level_sort_order IS NULL OR required_level_sort_order >= 0
    ),
    CONSTRAINT chk_formats_sort_order CHECK (sort_order >= 0),
    CONSTRAINT uq_formats_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_formats_tenant_id ON formats(tenant_id);
CREATE INDEX idx_formats_tenant_active ON formats(tenant_id, active);

CREATE TABLE categories (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    parent_id       BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT uq_categories_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX idx_categories_tenant_active ON categories(tenant_id, active);
CREATE INDEX idx_categories_parent_id ON categories(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE episodes (
    id                              BIGSERIAL PRIMARY KEY,
    tenant_id                       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    series_id                       BIGINT NOT NULL REFERENCES podcast_series(id) ON DELETE CASCADE,
    episode_number                  INT,
    slug                            VARCHAR(64) NOT NULL,
    title                           VARCHAR(255) NOT NULL,
    description                     TEXT,
    audio_asset_id                  BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    duration_seconds                INT,
    access_policy                   VARCHAR(16) NOT NULL DEFAULT 'FREE',
    required_level_sort_order       INT,
    status                          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at                    TIMESTAMPTZ,
    scheduled_at                    TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_episodes_episode_number CHECK (episode_number IS NULL OR episode_number > 0),
    CONSTRAINT chk_episodes_duration_seconds CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    CONSTRAINT chk_episodes_access_policy CHECK (access_policy IN ('FREE', 'PAID')),
    CONSTRAINT chk_episodes_required_level CHECK (
        required_level_sort_order IS NULL OR required_level_sort_order >= 0
    ),
    CONSTRAINT chk_episodes_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_episodes_scheduled_at CHECK (
        (status = 'SCHEDULED' AND scheduled_at IS NOT NULL)
        OR (status <> 'SCHEDULED')
    ),
    CONSTRAINT uq_episodes_series_slug UNIQUE (series_id, slug)
);

CREATE INDEX idx_episodes_tenant_id ON episodes(tenant_id);
CREATE INDEX idx_episodes_series_id ON episodes(series_id);
CREATE INDEX idx_episodes_tenant_status ON episodes(tenant_id, status);
CREATE INDEX idx_episodes_tenant_published ON episodes(tenant_id, published_at DESC)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_episodes_scheduled_due ON episodes(scheduled_at)
    WHERE status = 'SCHEDULED';

CREATE TABLE episode_formats (
    episode_id  BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    format_id   BIGINT NOT NULL REFERENCES formats(id) ON DELETE RESTRICT,
    PRIMARY KEY (episode_id, format_id)
);

CREATE INDEX idx_episode_formats_format_id ON episode_formats(format_id);

CREATE TABLE episode_categories (
    episode_id   BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    category_id  BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (episode_id, category_id)
);

CREATE INDEX idx_episode_categories_category_id ON episode_categories(category_id);
