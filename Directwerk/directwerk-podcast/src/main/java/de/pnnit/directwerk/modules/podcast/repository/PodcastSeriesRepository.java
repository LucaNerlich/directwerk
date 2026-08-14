package de.pnnit.directwerk.modules.podcast.repository;

import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PodcastSeriesRepository extends JpaRepository<PodcastSeries, Long> {

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    List<PodcastSeries> findByTenantIdOrderByTitleAscIdAsc(Long tenantId);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    List<PodcastSeries> findByTenantIdAndStatusOrderByTitleAscIdAsc(Long tenantId, SeriesStatus status);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    Optional<PodcastSeries> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"coverAsset", "coverAsset.tenant"})
    Optional<PodcastSeries> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);
}
