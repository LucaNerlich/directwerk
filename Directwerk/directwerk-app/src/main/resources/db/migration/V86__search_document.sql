-- Tenant search index for the public header. Ranking is client-side (Fuse);
-- this table stores stripped text only. No tsvector / GIN.

CREATE TABLE search_document (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    kind        VARCHAR(32) NOT NULL,
    source_id   BIGINT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    slug        VARCHAR(64) NOT NULL,
    plain_text  TEXT NOT NULL,
    excerpt     TEXT NOT NULL,
    href_path   VARCHAR(160) NOT NULL,
    access      VARCHAR(8) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_search_document_source UNIQUE (tenant_id, kind, source_id),
    CONSTRAINT chk_search_document_kind CHECK (
        kind IN ('article', 'episode', 'newsletter_list', 'product')
    ),
    CONSTRAINT chk_search_document_access CHECK (access IN ('FREE', 'PAID'))
);

CREATE INDEX idx_search_document_tenant_id ON search_document (tenant_id);

-- One-shot backfill of rows that are already public. Later writes go through the app.
CREATE FUNCTION search_plain_text(raw text) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT left(
        btrim(regexp_replace(
            regexp_replace(coalesce(raw, ''), '<[^>]+>', ' ', 'g'),
            '[[:space:]]+', ' ', 'g'
        )),
        12000
    );
$$;

INSERT INTO search_document (
    tenant_id, kind, source_id, title, slug, plain_text, excerpt, href_path, access
)
SELECT
    a.tenant_id,
    'article',
    a.id,
    a.title,
    a.slug,
    search_plain_text(a.body),
    left(search_plain_text(coalesce(nullif(btrim(a.excerpt), ''), a.body)), 180),
    '/articles/' || a.slug,
    a.access_policy
FROM articles a
WHERE a.status = 'PUBLISHED';

INSERT INTO search_document (
    tenant_id, kind, source_id, title, slug, plain_text, excerpt, href_path, access
)
SELECT
    e.tenant_id,
    'episode',
    e.id,
    e.title,
    e.slug,
    search_plain_text(e.description),
    left(search_plain_text(e.description), 180),
    '/episodes/' || e.slug,
    e.access_policy
FROM episodes e
WHERE e.status = 'PUBLISHED';

INSERT INTO search_document (
    tenant_id, kind, source_id, title, slug, plain_text, excerpt, href_path, access
)
SELECT
    l.tenant_id,
    'newsletter_list',
    l.id,
    l.name,
    l.slug,
    search_plain_text(l.description),
    left(search_plain_text(coalesce(nullif(btrim(l.description), ''), l.name)), 180),
    '/newsletter/' || l.slug,
    'FREE'
FROM newsletter_lists l
WHERE l.status = 'ACTIVE';

INSERT INTO search_document (
    tenant_id, kind, source_id, title, slug, plain_text, excerpt, href_path, access
)
SELECT
    p.tenant_id,
    'product',
    p.id,
    p.title,
    p.slug,
    search_plain_text(p.description),
    left(search_plain_text(coalesce(nullif(btrim(p.description), ''), p.title)), 180),
    '/pricing',
    'FREE'
FROM subscription_products p
WHERE p.active;

DROP FUNCTION search_plain_text(text);
