package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FormatServiceTest {

    @Mock
    private FormatRepository formatRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private RssFeedRefreshJobProducer rssFeedRefreshScheduler;

    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;

    private FormatService formatService;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        formatService = new FormatService(
                formatRepository,
                tenantRepository,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler
        );
        tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
    }

    @Test
    void createFormatNormalizesSlugAndDefaultsActive() {
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenant);
        when(formatRepository.existsByTenantIdAndSlug(10L, "bonus")).thenReturn(false);
        when(formatRepository.save(any(Format.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Format created = formatService.createFormat(
                10L,
                "Bonus",
                "Bonus",
                "Extra episodes",
                2,
                5,
                null
        );

        assertThat(created.getSlug()).isEqualTo("bonus");
        assertThat(created.getName()).isEqualTo("Bonus");
        assertThat(created.getRequiredLevelSortOrder()).isEqualTo(2);
        assertThat(created.getSortOrder()).isEqualTo(5);
        assertThat(created.isActive()).isTrue();
        verify(formatRepository).save(created);
    }

    @Test
    void createFormatRejectsDuplicateSlug() {
        when(formatRepository.existsByTenantIdAndSlug(10L, "bonus")).thenReturn(true);

        assertThatThrownBy(() -> formatService.createFormat(10L, "bonus", "Bonus", null, null, null, null))
                .isInstanceOf(de.pnnit.directwerk.modules.core.exception.ConflictException.class)
                .hasMessageContaining("bonus");
    }

    @Test
    void listFormatsCanFilterToActiveOnly() {
        Format active = format(1L, true);
        when(formatRepository.findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(10L))
                .thenReturn(List.of(active));

        assertThat(formatService.listFormats(10L, true)).containsExactly(active);
    }

    @Test
    void deactivateFormatMarksInactive() {
        Format format = format(1L, true);
        when(formatRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(format));
        when(formatRepository.save(any(Format.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Format deactivated = formatService.deactivateFormat(10L, 1L);

        assertThat(deactivated.isActive()).isFalse();
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void updateFormatRequiredLevelRequestsRssRefresh() {
        Format format = format(1L, true);
        format.setRequiredLevelSortOrder(1);
        when(formatRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(format));
        when(formatRepository.save(any(Format.class))).thenAnswer(invocation -> invocation.getArgument(0));

        formatService.updateFormat(10L, 1L, null, null, null, 3, null, null, null);

        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void updateFormatNameDoesNotRequestRssRefresh() {
        Format format = format(1L, true);
        when(formatRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(format));
        when(formatRepository.save(any(Format.class))).thenAnswer(invocation -> invocation.getArgument(0));

        formatService.updateFormat(10L, 1L, null, "Renamed", null, null, null, null, null);

        verify(rssFeedRefreshScheduler, never()).requestRefreshAfterCommit(10L);
    }

    @Test
    void requireFormatThrowsWhenMissing() {
        when(formatRepository.findByIdAndTenantId(404L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> formatService.requireFormat(10L, 404L))
                .isInstanceOf(FormatNotFoundException.class);
    }

    private Format format(Long id, boolean active) {
        Format format = new Format();
        format.setId(id);
        format.setTenant(tenant);
        format.setSlug("main");
        format.setName("Main");
        format.setActive(active);
        return format;
    }
}
