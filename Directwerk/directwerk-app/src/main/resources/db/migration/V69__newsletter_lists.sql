-- Newsletter mailing lists (Write desk) + guest subscriptions + article attachment.

CREATE TABLE newsletter_lists (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_newsletter_lists_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_newsletter_lists_tenant_slug UNIQUE (tenant_id, slug),
    CONSTRAINT chk_newsletter_lists_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX idx_newsletter_lists_tenant_id ON newsletter_lists(tenant_id);
CREATE INDEX idx_newsletter_lists_tenant_status ON newsletter_lists(tenant_id, status);

CREATE TABLE newsletter_subscriptions (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT NOT NULL,
    list_id                     BIGINT NOT NULL,
    email                       VARCHAR(320) NOT NULL,
    status                      VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirm_token_hash          VARCHAR(64),
    unsubscribe_token_hash      VARCHAR(64) NOT NULL,
    unsubscribe_token_protected TEXT NOT NULL,
    confirmed_at                TIMESTAMPTZ,
    unsubscribed_at             TIMESTAMPTZ,
    source                      VARCHAR(32) NOT NULL DEFAULT 'PUBLIC_FORM',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_newsletter_subscriptions_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_newsletter_subscriptions_list_email UNIQUE (list_id, email),
    CONSTRAINT uq_newsletter_subscriptions_confirm_hash UNIQUE (confirm_token_hash),
    CONSTRAINT uq_newsletter_subscriptions_unsub_hash UNIQUE (unsubscribe_token_hash),
    CONSTRAINT fk_newsletter_subscriptions_tenant_list
        FOREIGN KEY (tenant_id, list_id)
        REFERENCES newsletter_lists (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT chk_newsletter_subscriptions_status
        CHECK (status IN ('PENDING', 'ACTIVE', 'UNSUBSCRIBED')),
    CONSTRAINT chk_newsletter_subscriptions_source
        CHECK (source IN ('PUBLIC_FORM', 'STUDIO_IMPORT', 'ADMIN'))
);

CREATE INDEX idx_newsletter_subscriptions_tenant_id ON newsletter_subscriptions(tenant_id);
CREATE INDEX idx_newsletter_subscriptions_list_status ON newsletter_subscriptions(list_id, status);
CREATE INDEX idx_newsletter_subscriptions_email ON newsletter_subscriptions(tenant_id, email);

CREATE TABLE article_newsletter_lists (
    tenant_id    BIGINT NOT NULL,
    article_id   BIGINT NOT NULL,
    list_id      BIGINT NOT NULL,
    PRIMARY KEY (article_id, list_id),
    CONSTRAINT fk_article_newsletter_lists_tenant_article
        FOREIGN KEY (tenant_id, article_id)
        REFERENCES articles (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_article_newsletter_lists_tenant_list
        FOREIGN KEY (tenant_id, list_id)
        REFERENCES newsletter_lists (tenant_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_article_newsletter_lists_list_id ON article_newsletter_lists(list_id);
CREATE INDEX idx_article_newsletter_lists_tenant_id ON article_newsletter_lists(tenant_id);

-- JPA @JoinTable inserts only (article_id, list_id); derive tenant_id from the article row.
CREATE OR REPLACE FUNCTION sync_article_newsletter_lists_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT a.tenant_id INTO STRICT NEW.tenant_id
    FROM articles a
    WHERE a.id = NEW.article_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_article_newsletter_lists_tenant_id
    BEFORE INSERT OR UPDATE OF article_id ON article_newsletter_lists
    FOR EACH ROW
    EXECUTE FUNCTION sync_article_newsletter_lists_tenant_id();
