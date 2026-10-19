package de.pnnit.directwerk.modules.podcast.repository;

import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PodcastSeriesRepository extends JpaRepository<PodcastSeries, Long> {

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    List<PodcastSeries> findByTenantIdOrderByTitleAscIdAsc(Long tenantId);

    /**
     * Paged variant (#310) — bounds the response instead of materialising every row.
     * Review finding on #531: no graph here. The studio series view reads only
     * {@code coverAsset.getId()} ({@code SeriesController.toView}), so fetching the asset and its
     * tenant eagerly was dead weight — and the test that was supposed to pin it passed with the
     * annotations removed.
     */
    List<PodcastSeries> findByTenantIdOrderByTitleAscIdAsc(Long tenantId, Pageable pageable);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    List<PodcastSeries> findByTenantIdAndStatusOrderByTitleAscIdAsc(Long tenantId, SeriesStatus status);

    /**
     * Paged variant (#310) — bounds the response instead of materialising every row.
     * Review finding on #531: no graph here. The studio series view reads only
     * {@code coverAsset.getId()} ({@code SeriesController.toView}), so fetching the asset and its
     * tenant eagerly was dead weight — and the test that was supposed to pin it passed with the
     * annotations removed.
     */
    List<PodcastSeries> findByTenantIdAndStatusOrderByTitleAscIdAsc(Long tenantId, SeriesStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    Optional<PodcastSeries> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    Optional<PodcastSeries> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);
}
