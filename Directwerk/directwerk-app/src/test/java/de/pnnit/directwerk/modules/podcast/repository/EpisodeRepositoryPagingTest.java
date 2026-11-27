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

    @Test
    void searchFiltersBySeriesAndQuery() {
        Fixture a = persistFixture("show-a");
        Fixture b = persistFixture("show-b");
        persistEpisode(a, "batman-arkham", "Batman: Arkham Asylum", NOW);
        persistEpisode(a, "curses", "Curses", NOW);
        persistEpisode(b, "batman-other", "Batman: Other", NOW);
        entityManager.clear();

        var bySeriesIds = episodeRepository.searchIdsByTenantId(
                a.tenantId(), a.series().getId(), null,
                OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        assertThat(episodeRepository.findPublicByIds(a.tenantId(), bySeriesIds))
                .extracting(Episode::getSlug)
                .containsExactlyInAnyOrder("batman-arkham", "curses");

        var byTitleIds = episodeRepository.searchIdsByTenantId(
                a.tenantId(), null, "BATMAN",
                OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        assertThat(episodeRepository.findPublicByIds(a.tenantId(), byTitleIds))
                .extracting(Episode::getSlug).containsExactly("batman-arkham");

        var bySlugIds = episodeRepository.searchIdsByTenantId(
                a.tenantId(), null, "curs",
                OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        assertThat(episodeRepository.findPublicByIds(a.tenantId(), bySlugIds))
                .extracting(Episode::getSlug).containsExactly("curses");
    }

    @Test
    void searchTreatsEscapedWildcardsLiterally() {
        Fixture fixture = persistFixture("escape-show");
        persistEpisode(fixture, "fifty-percent", "50% Off", NOW);
        persistEpisode(fixture, "other", "Something Else", NOW);
        entityManager.clear();

        var hits = episodeRepository.searchIdsByTenantId(
                fixture.tenantId(), null, "50!%",
                OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        assertThat(episodeRepository.findPublicByIds(fixture.tenantId(), hits))
                .extracting(Episode::getSlug).containsExactly("fifty-percent");
    }

    @Test
    void searchIsTenantScoped() {
        Fixture a = persistFixture("tenant-a");
        Fixture b = persistFixture("tenant-b");
        persistEpisode(a, "shared-title-a", "Batman", NOW);
        persistEpisode(b, "shared-title-b", "Batman", NOW);
        entityManager.clear();

        var hits = episodeRepository.searchIdsByTenantId(
                a.tenantId(), null, "batman",
                OffsetLimitPageRequest.of(10, 0, PublicationSort.CREATED.toSort()));
        assertThat(episodeRepository.findPublicByIds(a.tenantId(), hits))
                .extracting(Episode::getSlug).containsExactly("shared-title-a");
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
