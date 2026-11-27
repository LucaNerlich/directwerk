package de.pnnit.directwerk.modules.podcast.repository;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EpisodeRepository extends JpaRepository<Episode, Long> {

    @EntityGraph(attributePaths = {"tenant", "series", "formats", "categories"})
    List<Episode> findByTenantIdAndIdIn(Long tenantId, Collection<Long> ids);

    // Keep graphs complete for open-in-view=false: controllers map series.slug, formats,
    // categories.parent, cover fallback (episode/format/series), and publicCdnUrl needs audioAsset.tenant.slug.

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByTenantIdOrderByCreatedAtDescIdDesc(Long tenantId);

    /**
     * Paged variant (#310) — bounds the response instead of materialising every row.
     * The graph must match the unpaged sibling: the controller maps series.slug, formats and
     * categories outside the transaction (open-in-view=false) and throws without it (#531).
     * Ordering comes from the pageable so studio can pick a sort.
     */
    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    List<Episode> findByTenantId(Long tenantId, Pageable pageable);

    /**
     * Studio list with optional series scope and title/slug search. Both filters are
     * optional so the plain list call keeps its shape; the caller passes a
     * {@link Pageable} with the requested sort.
     */
    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    @Query("""
            select e from Episode e
            where e.tenant.id = :tenantId
              and (:seriesId is null or e.series.id = :seriesId)
              and (:q is null
                   or lower(e.title) like lower(concat('%', :q, '%')) escape '!'
                   or lower(e.slug) like lower(concat('%', :q, '%')) escape '!')
            """)
    List<Episode> searchByTenantId(
            @Param("tenantId") Long tenantId,
            @Param("seriesId") Long seriesId,
            @Param("q") String q,
            Pageable pageable);

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

    // #1036 review: page the ids in SQL, then load the collection graph without paging so the
    // public catalog never hydrates the whole tenant corpus.
    @Query("""
            select e.id from Episode e
            where e.tenant.id = :tenantId
              and e.status = :status
              and e.series.status = :seriesStatus
            order by e.publishedAt desc, e.id desc
            """)
    List<Long> findPublishedIds(
            @Param("tenantId") Long tenantId,
            @Param("status") EpisodeStatus status,
            @Param("seriesStatus") SeriesStatus seriesStatus,
            Pageable pageable
    );

    @Query("""
            select e.id from Episode e
            where e.tenant.id = :tenantId
              and e.series.id = :seriesId
              and e.status = :status
              and e.series.status = :seriesStatus
            order by e.publishedAt desc, e.id desc
            """)
    List<Long> findPublishedIdsForSeries(
            @Param("tenantId") Long tenantId,
            @Param("seriesId") Long seriesId,
            @Param("status") EpisodeStatus status,
            @Param("seriesStatus") SeriesStatus seriesStatus,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    @Query("select e from Episode e where e.tenant.id = :tenantId and e.id in :ids")
    List<Episode> findPublicByIds(@Param("tenantId") Long tenantId, @Param("ids") Collection<Long> ids);

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

    /** Used when a series is published or withdrawn to refresh the search index. */
    List<Episode> findByTenantIdAndSeriesId(Long tenantId, Long seriesId);

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

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);

    @EntityGraph(attributePaths = {
            "tenant", "series", "series.coverAsset", "coverAsset", "coverAsset.tenant",
            "audioAsset", "audioAsset.tenant", "formats", "formats.coverAsset",
            "categories", "categories.parent"
    })
    Optional<Episode> findByTenantIdAndImportIdentity(Long tenantId, String importIdentity);

    /** Bulk lookup used by the import preview so it does not issue one query per feed item (#321). */
    List<Episode> findByTenantIdAndImportIdentityIn(Long tenantId, Collection<String> importIdentities);

    long countByTenantId(Long tenantId);

    boolean existsByTenantIdAndIdAndAudioAssetId(Long tenantId, Long id, Long audioAssetId);

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

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Episode e
            set e.emailNotifiedAt = null
            where e.id = :episodeId
              and e.tenant.id = :tenantId
            """)
    int clearEmailNotification(
            @Param("tenantId") Long tenantId,
            @Param("episodeId") Long episodeId
    );
}
