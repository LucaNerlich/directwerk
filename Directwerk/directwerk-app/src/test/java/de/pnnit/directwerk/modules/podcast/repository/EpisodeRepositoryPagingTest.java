package de.pnnit.directwerk.modules.podcast.repository;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

/**
 * #531: the paged repository overloads added in #310 dropped the {@code @EntityGraph} their
 * unpaged siblings carry, so the studio episode list threw
 * {@code LazyInitializationException} outside the (closed) transaction.
 */
@DataJpaTest
@ActiveProfiles("test")
class EpisodeRepositoryPagingTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired
    private EpisodeRepository episodeRepository;

    @Autowired
    private PodcastSeriesRepository podcastSeriesRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void pagedEpisodeQueryKeepsSeriesInitializedOutsideThePersistenceContext() {
        Long tenantId = persistEpisode("paging-show", "paging-episode");

        // Detach first: otherwise the query returns the very instance this test created (with its
        // associations already set) from the first-level cache and no lazy load ever happens.
        entityManager.clear();

        var page = episodeRepository.findByTenantIdOrderByCreatedAtDescIdDesc(
                tenantId, PageRequest.of(0, 10));
        entityManager.clear();

        assertThat(page).hasSize(1);
        // Without the graph this throws LazyInitializationException — the controller maps
        // series.slug after the service transaction has closed (open-in-view=false).
        assertThat(page.getFirst().getSeries().getSlug()).isEqualTo("paging-show");
    }

    @Test
    void pagedSeriesQueryKeepsItsGraph() {
        Long tenantId = persistEpisode("paging-show-two", "paging-episode-two");

        entityManager.clear();

        var page = podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(
                tenantId, PageRequest.of(0, 10));
        entityManager.clear();

        assertThat(page).hasSize(1);
        assertThat(page.getFirst().getSlug()).isEqualTo("paging-show-two");
        // coverAsset is intentionally unset; reading the field must not need a session.
        assertThat(page.getFirst().getCoverAsset()).isNull();
    }

    private Long persistEpisode(String seriesSlug, String episodeSlug) {
        Tenant tenant = new Tenant();
        tenant.setSlug(seriesSlug + "-tenant");
        tenant.setName("Paging Tenant");
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.setCreatedAt(NOW);
        tenant.setUpdatedAt(NOW);
        tenantRepository.save(tenant);

        PodcastSeries series = new PodcastSeries();
        series.setTenant(tenant);
        series.setSlug(seriesSlug);
        series.setTitle("Paging Show");
        series.setCreatedAt(NOW);
        series.setUpdatedAt(NOW);
        podcastSeriesRepository.save(series);

        Episode episode = new Episode();
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug(episodeSlug);
        episode.setTitle("Paging Episode");
        episode.setCreatedAt(NOW);
        episode.setUpdatedAt(NOW);
        episodeRepository.save(episode);
        entityManager.flush();

        return tenant.getId();
    }
}
