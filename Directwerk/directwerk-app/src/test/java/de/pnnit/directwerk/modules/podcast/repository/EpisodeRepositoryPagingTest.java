package de.pnnit.directwerk.modules.podcast.repository;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.content.PublicationSort;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.OffsetLimitPageRequest;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
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
        Fixture fixture = persistFixture("paging-show");
        persistEpisode(fixture, "paging-episode", "Paging Episode", null);

        // Detach first: otherwise the query returns the very instance this test created (with its
        // associations already set) from the first-level cache and no lazy load ever happens.
        entityManager.clear();

        var page = episodeRepository.findByTenantId(
                fixture.tenantId(), OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        entityManager.clear();

        assertThat(page).hasSize(1);
        // Without the graph this throws LazyInitializationException — the controller maps
        // series.slug after the service transaction has closed (open-in-view=false).
        assertThat(page.getFirst().getSeries().getSlug()).isEqualTo("paging-show");
    }

    @Test
    void pagedEpisodeQueryOrdersByRequestedSort() {
        Fixture fixture = persistFixture("sort-show");
        persistEpisode(fixture, "sort-a", "Alpha", Instant.parse("2026-01-01T00:00:00Z"));
        persistEpisode(fixture, "sort-b", "Zebra", Instant.parse("2026-01-02T00:00:00Z"));
        entityManager.clear();

        var byTitle = episodeRepository.findByTenantId(
                fixture.tenantId(), OffsetLimitPageRequest.of(10, 0, PublicationSort.TITLE.toSort()));
        assertThat(byTitle).extracting(Episode::getSlug).containsExactly("sort-a", "sort-b");

        var byPublished = episodeRepository.findByTenantId(
                fixture.tenantId(), OffsetLimitPageRequest.of(10, 0, PublicationSort.PUBLISHED.toSort()));
        assertThat(byPublished).extracting(Episode::getSlug).containsExactly("sort-b", "sort-a");
    }

    private Fixture persistFixture(String seriesSlug) {
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

        return new Fixture(tenant, series);
    }

    private void persistEpisode(Fixture fixture, String episodeSlug, String title, Instant publishedAt) {
        Episode episode = new Episode();
        episode.setTenant(fixture.tenant());
        episode.setSeries(fixture.series());
        episode.setSlug(episodeSlug);
        episode.setTitle(title);
        episode.setPublishedAt(publishedAt);
        episode.setCreatedAt(NOW);
        episode.setUpdatedAt(NOW);
        episodeRepository.save(episode);
        entityManager.flush();
    }

    private record Fixture(Tenant tenant, PodcastSeries series) {
        Long tenantId() {
            return tenant.getId();
        }
    }
}
