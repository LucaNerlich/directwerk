-- Composite (tenant_id, id) keys on referenced tables for tenant-scoped FK enforcement.
ALTER TABLE media_assets
    ADD CONSTRAINT uq_media_assets_tenant_id UNIQUE (tenant_id, id);

ALTER TABLE categories
    ADD CONSTRAINT uq_categories_tenant_id UNIQUE (tenant_id, id);

CREATE TABLE articles (
    id                              BIGSERIAL PRIMARY KEY,
    tenant_id                       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug                            VARCHAR(64) NOT NULL,
    title                           VARCHAR(255) NOT NULL,
    body                            TEXT,
    excerpt                         TEXT,
    seo_description                 VARCHAR(512),
    hero_asset_id                   BIGINT,
    access_policy                   VARCHAR(16) NOT NULL DEFAULT 'FREE',
    required_level_sort_order       INT,
    status                          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at                    TIMESTAMPTZ,
    scheduled_at                    TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_articles_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_articles_tenant_hero_asset
        FOREIGN KEY (tenant_id, hero_asset_id)
        REFERENCES media_assets (tenant_id, id),
    CONSTRAINT fk_articles_hero_asset
        FOREIGN KEY (hero_asset_id)
        REFERENCES media_assets (id)
        ON DELETE SET NULL,
    CONSTRAINT chk_articles_access_policy CHECK (access_policy IN ('FREE', 'PAID')),
    CONSTRAINT chk_articles_required_level CHECK (
        required_level_sort_order IS NULL OR required_level_sort_order >= 0
    ),
    CONSTRAINT chk_articles_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_articles_scheduled_at CHECK (
        (status = 'SCHEDULED' AND scheduled_at IS NOT NULL)
        OR (status <> 'SCHEDULED' AND scheduled_at IS NULL)
    ),
    CONSTRAINT uq_articles_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_articles_tenant_id ON articles(tenant_id);
CREATE INDEX idx_articles_tenant_status ON articles(tenant_id, status);
CREATE INDEX idx_articles_tenant_published ON articles(tenant_id, published_at DESC)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_articles_scheduled_due ON articles(scheduled_at)
    WHERE status = 'SCHEDULED';

CREATE TABLE article_categories (
    tenant_id    BIGINT NOT NULL,
    article_id   BIGINT NOT NULL,
    category_id  BIGINT NOT NULL,
    PRIMARY KEY (article_id, category_id),
    CONSTRAINT fk_article_categories_tenant_article
        FOREIGN KEY (tenant_id, article_id)
        REFERENCES articles (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_article_categories_tenant_category
        FOREIGN KEY (tenant_id, category_id)
        REFERENCES categories (tenant_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_article_categories_category_id ON article_categories(category_id);
CREATE INDEX idx_article_categories_tenant_id ON article_categories(tenant_id);

-- JPA @JoinTable inserts only (article_id, category_id); derive tenant_id from the article row.
CREATE OR REPLACE FUNCTION sync_article_categories_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT a.tenant_id INTO STRICT NEW.tenant_id
    FROM articles a
    WHERE a.id = NEW.article_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_article_categories_tenant_id
    BEFORE INSERT OR UPDATE OF article_id ON article_categories
    FOR EACH ROW
    EXECUTE FUNCTION sync_article_categories_tenant_id();
