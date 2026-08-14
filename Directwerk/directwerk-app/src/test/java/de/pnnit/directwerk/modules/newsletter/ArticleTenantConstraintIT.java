package de.pnnit.directwerk.modules.newsletter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class ArticleTenantConstraintIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void rejectsCrossTenantHeroAssetReference() {
        TenantFixture tenantA = insertTenant("article-fk-a-" + suffix());
        TenantFixture tenantB = insertTenant("article-fk-b-" + suffix());
        long foreignAssetId = insertMediaAsset(tenantB.id(), tenantB.slug() + "/public/images/hero.jpg");

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO articles (tenant_id, slug, title, hero_asset_id)
                VALUES (?, ?, ?, ?)
                """,
                tenantA.id(),
                "cross-hero-" + suffix(),
                "Cross-tenant hero",
                foreignAssetId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsCrossTenantCategoryReference() {
        TenantFixture tenantA = insertTenant("article-cat-a-" + suffix());
        TenantFixture tenantB = insertTenant("article-cat-b-" + suffix());
        long articleId = insertArticle(tenantA.id(), "article-" + suffix());
        long foreignCategoryId = insertCategory(tenantB.id(), "foreign-cat-" + suffix());

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO article_categories (article_id, category_id)
                VALUES (?, ?)
                """,
                articleId,
                foreignCategoryId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullsHeroAssetIdWithoutClearingTenantWhenMediaAssetDeleted() {
        TenantFixture tenant = insertTenant("hero-delete-" + suffix());
        long assetId = insertMediaAsset(tenant.id(), tenant.slug() + "/public/images/hero.jpg");
        long articleId = jdbcTemplate.queryForObject(
                """
                INSERT INTO articles (tenant_id, slug, title, hero_asset_id)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                "hero-delete-" + suffix(),
                "Hero delete article",
                assetId
        );

        jdbcTemplate.update("DELETE FROM media_assets WHERE id = ?", assetId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM articles WHERE id = ?",
                Long.class,
                articleId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT hero_asset_id FROM articles WHERE id = ?",
                Long.class,
                articleId
        )).isNull();
    }

    @Test
    void acceptsSameTenantHeroAssetAndCategoryReferences() {
        TenantFixture tenant = insertTenant("article-ok-" + suffix());
        long assetId = insertMediaAsset(tenant.id(), tenant.slug() + "/public/images/hero.jpg");
        long categoryId = insertCategory(tenant.id(), "local-cat-" + suffix());

        long articleId = jdbcTemplate.queryForObject(
                """
                INSERT INTO articles (tenant_id, slug, title, hero_asset_id)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                "same-tenant-" + suffix(),
                "Same-tenant article",
                assetId
        );

        jdbcTemplate.update(
                """
                INSERT INTO article_categories (article_id, category_id)
                VALUES (?, ?)
                """,
                articleId,
                categoryId
        );

        assertThat(jdbcTemplate.queryForObject(
                "SELECT hero_asset_id FROM articles WHERE id = ?",
                Long.class,
                articleId
        )).isEqualTo(assetId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM article_categories WHERE article_id = ? AND category_id = ?",
                Long.class,
                articleId,
                categoryId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article_categories WHERE article_id = ? AND category_id = ?",
                Integer.class,
                articleId,
                categoryId
        )).isEqualTo(1);
    }

    private TenantFixture insertTenant(String slug) {
        long id = jdbcTemplate.queryForObject(
                """
                INSERT INTO tenants (slug, name, status)
                VALUES (?, ?, 'ACTIVE')
                RETURNING id
                """,
                Long.class,
                slug,
                slug
        );
        return new TenantFixture(id, slug);
    }

    private long insertMediaAsset(long tenantId, String s3Key) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status
                )
                VALUES (?, ?, 'PUBLIC', 'TENANT_PUBLIC', 'IMAGE', 'READY')
                RETURNING id
                """,
                Long.class,
                tenantId,
                s3Key
        );
    }

    private long insertCategory(long tenantId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO categories (tenant_id, slug, name, active)
                VALUES (?, ?, ?, TRUE)
                RETURNING id
                """,
                Long.class,
                tenantId,
                slug,
                slug
        );
    }

    private long insertArticle(long tenantId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO articles (tenant_id, slug, title)
                VALUES (?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenantId,
                slug,
                "Article " + slug
        );
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private record TenantFixture(long id, String slug) {}
}
