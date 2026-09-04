package de.pnnit.directwerk.modules.podcast.service;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class SeriesServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long SERIES_ID = 3L;

    @Mock
    private PodcastSeriesRepository podcastSeriesRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;

    @Mock
    private RssFeedRefreshScheduler rssFeedRefreshScheduler;

    @Mock
    private HtmlSanitizer htmlSanitizer;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    private SeriesService seriesService;

    @BeforeEach
    void wireService() {
        seriesService = new SeriesService(
                podcastSeriesRepository,
                tenantRepository,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler,
                htmlSanitizer,
                new MembershipPermissionService(
                        overrideRepository, tenantMembershipRepository, tenantRepository,
                        platformAuditService));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createSeriesRecordsCreatorFromContext() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        when(tenantRepository.getReferenceById(TENANT_ID)).thenReturn(tenant);
        when(podcastCoverAssetResolver.resolveCoverAsset(TENANT_ID, null)).thenReturn(null);
        when(podcastSeriesRepository.save(any(PodcastSeries.class))).thenAnswer(invocation -> {
            PodcastSeries series = invocation.getArgument(0);
            series.setId(SERIES_ID);
            return series;
        });
        authenticate(5L, Role.EDITOR);

        seriesService.createSeries(TENANT_ID, "show", "Show", null, null, "de", null, false, null);

        org.mockito.ArgumentCaptor<PodcastSeries> captor =
                org.mockito.ArgumentCaptor.forClass(PodcastSeries.class);
        verify(podcastSeriesRepository).save(captor.capture());
        assertThat(captor.getValue().getCreatedBy()).isEqualTo(5L);
    }

    @Test
    void updateDeniedForStrangerWithOwnOnlyRestriction() {
        PodcastSeries series = series();
        series.setCreatedBy(99L);
        when(podcastSeriesRepository.findByIdAndTenantId(SERIES_ID, TENANT_ID))
                .thenReturn(Optional.of(series));
        when(overrideRepository.findByTenantIdAndUserId(TENANT_ID, 5L)).thenReturn(List.of(
                override(ContentEntityType.SERIES, ContentOperation.UPDATE, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        assertThatThrownBy(() -> seriesService.updateSeries(
                        TENANT_ID, SERIES_ID, null, "Neu", null, null, null, null, null, null, null))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
        verify(podcastSeriesRepository, never()).save(any(PodcastSeries.class));
    }

    private static PodcastSeries series() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        PodcastSeries series = new PodcastSeries();
        series.setId(SERIES_ID);
        series.setTenant(tenant);
        series.setSlug("show");
        series.setTitle("Show");
        series.setStatus(SeriesStatus.DRAFT);
        return series;
    }

    private static void authenticate(Long userId, Role... roles) {
        List<SimpleGrantedAuthority> authorities = Arrays.stream(roles)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId, "user@example.com", "hash", TENANT_ID, authorities);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

}
