package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.UncategorizedSQLException;
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
class TenantScopedForeignKeyIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void rejectsCrossTenantSeriesCoverAsset() {
        TenantFixture tenantA = insertTenant("series-cover-a-" + suffix());
        TenantFixture tenantB = insertTenant("series-cover-b-" + suffix());
        long foreignAssetId = insertMediaAsset(
                tenantB.id(),
                tenantB.slug() + "/public/images/cover.jpg",
                "IMAGE"
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO podcast_series (tenant_id, slug, title, cover_asset_id)
                VALUES (?, ?, ?, ?)
                """,
                tenantA.id(),
                "cross-cover-" + suffix(),
                "Cross cover",
                foreignAssetId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullsSeriesCoverAssetIdWithoutClearingTenantWhenMediaAssetDeleted() {
        TenantFixture tenant = insertTenant("cover-del-" + suffix());
        long assetId = insertMediaAsset(tenant.id(), tenant.slug() + "/public/images/cover.jpg", "IMAGE");
        long seriesId = jdbcTemplate.queryForObject(
                """
                INSERT INTO podcast_series (tenant_id, slug, title, cover_asset_id)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                "cover-del-" + suffix(),
                "Cover delete",
                assetId
        );

        jdbcTemplate.update("DELETE FROM media_assets WHERE id = ?", assetId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM podcast_series WHERE id = ?",
                Long.class,
                seriesId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT cover_asset_id FROM podcast_series WHERE id = ?",
                Long.class,
                seriesId
        )).isNull();
    }

    @Test
    void rejectsCrossTenantEpisodeSeriesAndAudioAsset() {
        TenantFixture tenantA = insertTenant("episode-a-" + suffix());
        TenantFixture tenantB = insertTenant("episode-b-" + suffix());
        long foreignSeriesId = insertSeries(tenantB.id(), "foreign-series-" + suffix());
        long foreignAssetId = insertMediaAsset(tenantB.id(), tenantB.slug() + "/private/audio/ep.mp3", "AUDIO");

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO episodes (tenant_id, series_id, slug, title)
                VALUES (?, ?, ?, ?)
                """,
                tenantA.id(),
                foreignSeriesId,
                "cross-series-" + suffix(),
                "Cross series"
        )).isInstanceOf(DataIntegrityViolationException.class);

        long seriesId = insertSeries(tenantA.id(), "local-series-" + suffix());
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO episodes (tenant_id, series_id, slug, title, audio_asset_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                tenantA.id(),
                seriesId,
                "cross-audio-" + suffix(),
                "Cross audio",
                foreignAssetId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullsEpisodeAudioAssetIdWithoutClearingTenantWhenMediaAssetDeleted() {
        TenantFixture tenant = insertTenant("audio-del-" + suffix());
        long seriesId = insertSeries(tenant.id(), "audio-del-series-" + suffix());
        long assetId = insertMediaAsset(tenant.id(), tenant.slug() + "/private/audio/ep.mp3", "AUDIO");
        long episodeId = jdbcTemplate.queryForObject(
                """
                INSERT INTO episodes (tenant_id, series_id, slug, title, audio_asset_id)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                seriesId,
                "audio-del-" + suffix(),
                "Audio delete",
                assetId
        );

        jdbcTemplate.update("DELETE FROM media_assets WHERE id = ?", assetId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM episodes WHERE id = ?",
                Long.class,
                episodeId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT audio_asset_id FROM episodes WHERE id = ?",
                Long.class,
                episodeId
        )).isNull();
    }

    @Test
    void rejectsCrossTenantCategoryParentAndEpisodeCategory() {
        TenantFixture tenantA = insertTenant("category-a-" + suffix());
        TenantFixture tenantB = insertTenant("category-b-" + suffix());
        long foreignParentId = insertCategory(tenantB.id(), "foreign-parent-" + suffix());

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO categories (tenant_id, slug, name, parent_id)
                VALUES (?, ?, ?, ?)
                """,
                tenantA.id(),
                "cross-parent-" + suffix(),
                "Cross parent",
                foreignParentId
        )).isInstanceOf(DataIntegrityViolationException.class);

        long seriesId = insertSeries(tenantA.id(), "cat-series-" + suffix());
        long episodeId = insertEpisode(tenantA.id(), seriesId, "cat-episode-" + suffix());
        long foreignCategoryId = insertCategory(tenantB.id(), "foreign-cat-" + suffix());

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO episode_categories (tenant_id, episode_id, category_id)
                VALUES (?, ?, ?)
                """,
                tenantA.id(),
                episodeId,
                foreignCategoryId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullsCategoryParentIdWithoutClearingTenantWhenParentDeleted() {
        TenantFixture tenant = insertTenant("parent-del-" + suffix());
        long parentId = insertCategory(tenant.id(), "parent-" + suffix());
        long childId = jdbcTemplate.queryForObject(
                """
                INSERT INTO categories (tenant_id, slug, name, parent_id)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                "child-" + suffix(),
                "Child category",
                parentId
        );

        jdbcTemplate.update("DELETE FROM categories WHERE id = ?", parentId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM categories WHERE id = ?",
                Long.class,
                childId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT parent_id FROM categories WHERE id = ?",
                Long.class,
                childId
        )).isNull();
    }

    @Test
    void rejectsCrossTenantEpisodeFormat() {
        TenantFixture tenantA = insertTenant("format-a-" + suffix());
        TenantFixture tenantB = insertTenant("format-b-" + suffix());
        long seriesId = insertSeries(tenantA.id(), "fmt-series-" + suffix());
        long episodeId = insertEpisode(tenantA.id(), seriesId, "fmt-episode-" + suffix());
        long foreignFormatId = insertFormat(tenantB.id(), "foreign-format-" + suffix());

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO episode_formats (tenant_id, episode_id, format_id)
                VALUES (?, ?, ?)
                """,
                tenantA.id(),
                episodeId,
                foreignFormatId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsCrossTenantMediaAssetEpisodeLink() {
        TenantFixture tenantA = insertTenant("asset-ep-a-" + suffix());
        TenantFixture tenantB = insertTenant("asset-ep-b-" + suffix());
        long foreignEpisodeId = insertEpisode(
                tenantB.id(),
                insertSeries(tenantB.id(), "foreign-series-" + suffix()),
                "foreign-episode-" + suffix()
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status, episode_id
                )
                VALUES (?, ?, 'PRIVATE', 'CONTENT', 'AUDIO', 'READY', ?)
                """,
                tenantA.id(),
                tenantA.slug() + "/private/audio/linked.mp3",
                foreignEpisodeId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullsMediaAssetEpisodeIdWithoutClearingTenantWhenEpisodeDeleted() {
        TenantFixture tenant = insertTenant("asset-ep-del-" + suffix());
        long seriesId = insertSeries(tenant.id(), "asset-ep-series-" + suffix());
        long episodeId = insertEpisode(tenant.id(), seriesId, "asset-ep-" + suffix());
        long assetId = jdbcTemplate.queryForObject(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status, episode_id
                )
                VALUES (?, ?, 'PRIVATE', 'CONTENT', 'AUDIO', 'READY', ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                tenant.slug() + "/private/audio/linked.mp3",
                episodeId
        );

        jdbcTemplate.update("DELETE FROM episodes WHERE id = ?", episodeId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM media_assets WHERE id = ?",
                Long.class,
                assetId
        )).isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT episode_id FROM media_assets WHERE id = ?",
                Long.class,
                assetId
        )).isNull();
    }

    @Test
    void rejectsCrossTenantMediaFolderReferences() {
        TenantFixture tenantA = insertTenant("folder-a-" + suffix());
        TenantFixture tenantB = insertTenant("folder-b-" + suffix());
        long foreignFolderId = insertMediaFolder(tenantB.id(), "Foreign", null);

        assertThatThrownBy(() -> insertMediaFolder(tenantA.id(), "Cross parent", foreignFolderId))
                .isInstanceOf(DataIntegrityViolationException.class);

        long assetId = insertMediaAsset(
                tenantA.id(), tenantA.slug() + "/public/images/folder.jpg", "IMAGE");
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE media_assets SET folder_id = ? WHERE id = ?",
                foreignFolderId,
                assetId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingMediaFolderNullsReferencesWithoutClearingTenant() {
        TenantFixture tenant = insertTenant("folder-del-" + suffix());
        long parentId = insertMediaFolder(tenant.id(), "Parent", null);
        long childId = insertMediaFolder(tenant.id(), "Child", parentId);
        long assetId = insertMediaAsset(
                tenant.id(), tenant.slug() + "/public/images/folder-delete.jpg", "IMAGE");
        jdbcTemplate.update("UPDATE media_assets SET folder_id = ? WHERE id = ?", parentId, assetId);

        jdbcTemplate.update("DELETE FROM media_folders WHERE id = ?", parentId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM media_folders WHERE id = ?", Long.class, childId))
                .isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT parent_id FROM media_folders WHERE id = ?", Long.class, childId))
                .isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM media_assets WHERE id = ?", Long.class, assetId))
                .isEqualTo(tenant.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT folder_id FROM media_assets WHERE id = ?", Long.class, assetId))
                .isNull();
    }

    @Test
    void rejectsCrossTenantProductAccessRuleProductAndScope() {
        TenantFixture tenantA = insertTenant("rule-a-" + suffix());
        TenantFixture tenantB = insertTenant("rule-b-" + suffix());
        long foreignProductId = insertProduct(tenantB.id(), "foreign-product-" + suffix());
        long foreignFormatId = insertFormat(tenantB.id(), "rule-format-" + suffix());
        long localProductId = insertProduct(tenantA.id(), "local-product-" + suffix());

        long localFormatId = insertFormat(tenantA.id(), "local-format-" + suffix());

        // Cross-tenant product: trigger passes (scope is same-tenant), FK rejects.
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO product_access_rules (tenant_id, product_id, scope_type, scope_id)
                VALUES (?, ?, 'FORMAT', ?)
                """,
                tenantA.id(),
                foreignProductId,
                localFormatId
        )).isInstanceOf(DataIntegrityViolationException.class);

        // Cross-tenant scope: trigger uses PL/pgSQL RAISE EXCEPTION (SQL state P0001), which
        // Spring wraps in UncategorizedSQLException rather than DataIntegrityViolationException.
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO product_access_rules (tenant_id, product_id, scope_type, scope_id)
                VALUES (?, ?, 'FORMAT', ?)
                """,
                tenantA.id(),
                localProductId,
                foreignFormatId
        )).isInstanceOfAny(DataIntegrityViolationException.class, UncategorizedSQLException.class);
    }

    @Test
    void rejectsSubscriptionAndFeedForNonMemberUser() {
        TenantFixture tenantA = insertTenant("member-a-" + suffix());
        TenantFixture tenantB = insertTenant("member-b-" + suffix());
        long userId = insertUser("member-" + suffix() + "@example.com");
        insertMembership(tenantB.id(), userId);
        long productId = insertProduct(tenantA.id(), "member-product-" + suffix());

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO subscriptions (tenant_id, user_id, product_id)
                VALUES (?, ?, ?)
                """,
                tenantA.id(),
                userId,
                productId
        )).isInstanceOf(DataIntegrityViolationException.class);

        String foreignToken = "token-" + suffix();
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO subscriber_feeds
                    (tenant_id, user_id, feed_token_protected, feed_token_hash, feed_token, title)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                tenantA.id(),
                userId,
                "prot-" + foreignToken,
                hashedToken(foreignToken),
                hashedToken(foreignToken),
                "Foreign feed"
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void acceptsSameTenantPodcastAndMembershipReferences() {
        TenantFixture tenant = insertTenant("ok-" + suffix());
        long userId = insertUser("ok-" + suffix() + "@example.com");
        insertMembership(tenant.id(), userId);
        long assetId = insertMediaAsset(tenant.id(), tenant.slug() + "/public/images/cover.jpg", "IMAGE");
        long seriesId = jdbcTemplate.queryForObject(
                """
                INSERT INTO podcast_series (tenant_id, slug, title, cover_asset_id)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                "ok-series-" + suffix(),
                "OK series",
                assetId
        );
        long episodeId = jdbcTemplate.queryForObject(
                """
                INSERT INTO episodes (tenant_id, series_id, slug, title, audio_asset_id)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                seriesId,
                "ok-episode-" + suffix(),
                "OK episode",
                assetId
        );
        long formatId = insertFormat(tenant.id(), "ok-format-" + suffix());
        long categoryId = insertCategory(tenant.id(), "ok-category-" + suffix());
        long productId = insertProduct(tenant.id(), "ok-product-" + suffix());

        jdbcTemplate.update(
                "INSERT INTO episode_formats (tenant_id, episode_id, format_id) VALUES (?, ?, ?)",
                tenant.id(),
                episodeId,
                formatId
        );
        jdbcTemplate.update(
                "INSERT INTO episode_categories (tenant_id, episode_id, category_id) VALUES (?, ?, ?)",
                tenant.id(),
                episodeId,
                categoryId
        );
        jdbcTemplate.update(
                """
                INSERT INTO product_access_rules (tenant_id, product_id, scope_type, scope_id)
                VALUES (?, ?, 'FORMAT', ?)
                """,
                tenant.id(),
                productId,
                formatId
        );
        jdbcTemplate.update(
                "INSERT INTO subscriptions (tenant_id, user_id, product_id) VALUES (?, ?, ?)",
                tenant.id(),
                userId,
                productId
        );
        String okToken = "ok-token-" + suffix();
        jdbcTemplate.update(
                """
                INSERT INTO subscriber_feeds
                    (tenant_id, user_id, feed_token_protected, feed_token_hash, feed_token, title)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                tenant.id(),
                userId,
                "prot-" + okToken,
                hashedToken(okToken),
                hashedToken(okToken),
                "OK feed"
        );

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM episode_formats WHERE episode_id = ? AND format_id = ?",
                Integer.class,
                episodeId,
                formatId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM subscriptions WHERE tenant_id = ? AND user_id = ?",
                Integer.class,
                tenant.id(),
                userId
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

    private long insertUser(String email) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO users (email, status)
                VALUES (?, 'ACTIVE')
                RETURNING id
                """,
                Long.class,
                email
        );
    }

    private void insertMembership(long tenantId, long userId) {
        jdbcTemplate.update(
                """
                INSERT INTO tenant_memberships (tenant_id, user_id, roles, status)
                VALUES (?, ?, '["SUBSCRIBER"]', 'ACTIVE')
                """,
                tenantId,
                userId
        );
    }

    private long insertMediaAsset(long tenantId, String s3Key, String assetType) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status
                )
                VALUES (?, ?, 'PUBLIC', 'TENANT_PUBLIC', ?, 'READY')
                RETURNING id
                """,
                Long.class,
                tenantId,
                s3Key,
                assetType
        );
    }

    private long insertMediaFolder(long tenantId, String name, Long parentId) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO media_folders (tenant_id, parent_id, name)
                VALUES (?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenantId,
                parentId,
                name
        );
    }

    private long insertSeries(long tenantId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO podcast_series (tenant_id, slug, title)
                VALUES (?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenantId,
                slug,
                "Series " + slug
        );
    }

    private long insertEpisode(long tenantId, long seriesId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO episodes (tenant_id, series_id, slug, title)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenantId,
                seriesId,
                slug,
                "Episode " + slug
        );
    }

    private long insertFormat(long tenantId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO formats (tenant_id, slug, name)
                VALUES (?, ?, ?)
                RETURNING id
                """,
                Long.class,
                tenantId,
                slug,
                slug
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

    private long insertProduct(long tenantId, String slug) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO subscription_products (tenant_id, slug, title, offering_type)
                VALUES (?, ?, ?, 'PACKAGE')
                RETURNING id
                """,
                Long.class,
                tenantId,
                slug,
                slug
        );
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String hashedToken(String rawToken) {
        return de.pnnit.directwerk.modules.core.util.TokenHashUtil.sha256Hex(rawToken);
    }

    private record TenantFixture(long id, String slug) {}
}
