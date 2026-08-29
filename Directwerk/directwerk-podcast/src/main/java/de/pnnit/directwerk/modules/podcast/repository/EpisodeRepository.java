package de.pnnit.directwerk.modules.podcast.repository;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EpisodeRepository extends JpaRepository<Episode, Long> {

    // Keep graphs complete for open-in-view=false: controllers map series.slug, formats,
    // categories.parent, cover fallback (episode/format/series), and publicCdnUrl needs audioAsset.tenant.slug.

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByTenantIdOrderByCreatedAtDescIdDesc(Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByTenantIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
            Long tenantId,
            EpisodeStatus status,
            SeriesStatus seriesStatus
    );

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByTenantIdAndSeriesIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
            Long tenantId,
            Long seriesId,
            EpisodeStatus status,
            SeriesStatus seriesStatus
    );

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    Optional<Episode> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    Optional<Episode> findBySeriesIdAndSlugAndTenantId(Long seriesId, String slug, Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    Optional<Episode> findByTenantIdAndSlugAndStatusAndSeriesStatus(
            Long tenantId,
            String slug,
            EpisodeStatus status,
            SeriesStatus seriesStatus
    );

    boolean existsBySeriesIdAndSlug(Long seriesId, String slug);

    boolean existsBySeriesIdAndSlugAndIdNot(Long seriesId, String slug, Long id);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    /**
 * Determines whether a tenant has an episode with the specified slug, excluding a particular episode.
 *
 * @param tenantId the tenant identifier
 * @param slug     the episode slug
 * @param id       the episode identifier to exclude
 * @return {@code true} if a matching episode exists for another episode, {@code false} otherwise
 */
boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);

    /**
     * Finds an episode for a tenant by its import identity.
     *
     * @param tenantId       the tenant identifier
     * @param importIdentity the external import identity
     * @return the matching episode, if one exists
     */
    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    Optional<Episode> findByTenantIdAndImportIdentity(Long tenantId, String importIdentity);

    long countByTenantId(Long tenantId);

    /**
     * Retrieves episodes with the specified status whose scheduled publication time has arrived, ordered by schedule time and ID.
     *
     * @param status      the episode status to match
     * @param scheduledAt the latest scheduled publication time to include
     * @return the matching episodes
     */
    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
            EpisodeStatus status,
            Instant scheduledAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Episode e
            set e.emailNotifiedAt = :notifiedAt
            where e.id = :episodeId
              and e.tenant.id = :tenantId
              and e.emailNotifiedAt is null
            """)
    int claimEmailNotification(
            @Param("tenantId") Long tenantId,
            @Param("episodeId") Long episodeId,
            @Param("notifiedAt") Instant notifiedAt
    );
}
