package de.pnnit.directwerk.modules.podcast.service;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
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
class EpisodeServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long EPISODE_ID = 7L;

    @Mock
    private EpisodeRepository episodeRepository;

    @Mock
    private SeriesService seriesService;

    @Mock
    private FormatRepository formatRepository;

    @Mock
    private CategoryService categoryService;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Mock
    private HtmlSanitizer htmlSanitizer;

    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;

    @Mock
    private RssFeedRefreshJobProducer rssFeedRefreshScheduler;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;


    private EpisodeService episodeService;

    @BeforeEach
    void wireService() {
        episodeService = new EpisodeService(
                episodeRepository,
                seriesService,
                formatRepository,
                categoryService,
                tenantRepository,
                episodeMediaApi,
                htmlSanitizer,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler,
                new MembershipPermissionService(
                        overrideRepository, tenantMembershipRepository, tenantRepository,
                        platformAuditService)
        );
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deletePublishedEpisodeDeletesAndRequestsFeedRefresh() {
        Episode published = episode(EpisodeStatus.PUBLISHED);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(published));

        episodeService.deleteEpisode(TENANT_ID, EPISODE_ID);

        verify(episodeRepository).delete(published);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(TENANT_ID);
    }

    @Test
    void deleteDraftEpisodeDeletesWithoutFeedRefresh() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));

        episodeService.deleteEpisode(TENANT_ID, EPISODE_ID);

        verify(episodeRepository).delete(draft);
        verify(rssFeedRefreshScheduler, never()).requestRefreshAfterCommit(anyLong());
    }

    @Test
    void deleteEpisodeThrowsWhenMissing() {
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> episodeService.deleteEpisode(TENANT_ID, EPISODE_ID))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    @Test
    void updateDraftCanClearCoverAsset() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        draft.setCoverAsset(new MediaAsset());
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        when(episodeRepository.save(draft)).thenReturn(draft);

        Episode updated = episodeService.updateDraft(
                TENANT_ID,
                EPISODE_ID,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                true
        );

        assertThat(updated.getCoverAsset()).isNull();
        verify(episodeRepository).save(draft);
    }

    private static Episode episode(EpisodeStatus status) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        Episode episode = new Episode();
        episode.setId(EPISODE_ID);
        episode.setTenant(tenant);
        episode.setSlug("episode-one");
        episode.setTitle("Episode One");
        episode.setStatus(status);
        return episode;
    }

    @Test
    void updateDraftDeniedForStrangerWithOwnOnlyRestriction() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        draft.setCreatedBy(99L);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        when(overrideRepository.findByTenantIdAndUserId(TENANT_ID, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.UPDATE, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        assertThatThrownBy(() -> episodeService.updateDraft(
                        TENANT_ID, EPISODE_ID, null, null, null, null, null, null, null, null, null))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
        verify(episodeRepository, never()).save(any());
    }

    @Test
    void updateDraftAllowedForOwnerWithOwnOnlyRestriction() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        draft.setCreatedBy(5L);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        when(episodeRepository.save(draft)).thenReturn(draft);
        when(overrideRepository.findByTenantIdAndUserId(TENANT_ID, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.UPDATE, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        episodeService.updateDraft(TENANT_ID, EPISODE_ID, null, null, null, null, null, null, null, null, null);

        verify(episodeRepository).save(draft);
    }

    @Test
    void deleteDeniedWithDenyOverrideEvenForOwner() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        draft.setCreatedBy(5L);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        when(overrideRepository.findByTenantIdAndUserId(TENANT_ID, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.DELETE, RestrictionScope.DENY)));
        authenticate(5L, Role.EDITOR);

        assertThatThrownBy(() -> episodeService.deleteEpisode(TENANT_ID, EPISODE_ID))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY);
        verify(episodeRepository, never()).delete(any());
    }

    @Test
    void tenantAdminBypassesRestrictions() {
        Episode draft = episode(EpisodeStatus.DRAFT);
        draft.setCreatedBy(99L);
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        authenticate(5L, Role.TENANT_ADMIN);

        episodeService.deleteEpisode(TENANT_ID, EPISODE_ID);

        verify(episodeRepository).delete(draft);
        verify(overrideRepository, never()).findByTenantIdAndUserId(anyLong(), anyLong());
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
