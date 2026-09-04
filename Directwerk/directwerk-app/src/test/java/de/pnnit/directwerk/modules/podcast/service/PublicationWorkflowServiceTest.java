package de.pnnit.directwerk.modules.podcast.service;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.ObjectProvider;

@ExtendWith(MockitoExtension.class)
class PublicationWorkflowServiceTest {

    @Mock
    private EpisodeRepository episodeRepository;

    @Mock
    private EpisodeService episodeService;

    @Mock
    private FormatService formatService;

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private ContentPublishedNotifier contentPublishedNotifier;

    @Mock
    private RssFeedRefreshScheduler rssFeedRefreshScheduler;

    private PublicationWorkflowService publicationWorkflowService;

    @Mock
    private SubscriberNotificationGate notificationGate;

    @Mock
    private ObjectProvider<PublicationWorkflowService> selfProvider;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantRepository tenantRepository;


    private ScheduledPublicationExecutor scheduledPublicationExecutor;

    @BeforeEach
    void setUp() {
        scheduledPublicationExecutor = new ScheduledPublicationExecutor(moduleGateService);
        publicationWorkflowService = new PublicationWorkflowService(
                episodeRepository,
                episodeService,
                formatService,
                episodeMediaApi,
                new HtmlSanitizer(),
                scheduledPublicationExecutor,
                contentPublishedNotifier,
                notificationGate,
                rssFeedRefreshScheduler,
                selfProvider,
                new MembershipPermissionService(
                        overrideRepository, tenantMembershipRepository, tenantRepository,
                        platformAuditService)
        );
        lenient().when(notificationGate.enabled(anyLong(), any(), anyLong())).thenReturn(true);
        lenient().when(selfProvider.getObject()).thenReturn(publicationWorkflowService);
        lenient().when(episodeRepository.save(any(Episode.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void publishFreeEpisodePromotesReadyAudioToPublic() {
        Episode episode = draftEpisode();
        episode.getFormats().add(activeFormat());
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");
        MediaAsset publicAudio = audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(true);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(episodeMediaApi.promoteToPublic(99L)).thenReturn(publicAudio);

        Episode published = publicationWorkflowService.publish(10L, 55L);

        assertThat(published.getStatus()).isEqualTo(EpisodeStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).isNotNull();
        assertThat(published.getScheduledAt()).isNull();
        assertThat(published.getDescription()).contains("<p>Show notes</p>");
        assertThat(published.getAudioAsset().getVisibility()).isEqualTo(AssetVisibility.PUBLIC);
        verify(episodeMediaApi).attachEpisode(99L, 55L);
        verify(episodeMediaApi).promoteToPublic(99L);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void publishPreservesImportedPublishedAt() {
        Instant importedAt = Instant.parse("2020-01-15T10:00:00Z");
        Episode episode = draftEpisode();
        episode.setPublishedAt(importedAt);
        episode.getFormats().add(activeFormat());
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");
        MediaAsset publicAudio = audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(true);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(episodeMediaApi.promoteToPublic(99L)).thenReturn(publicAudio);

        Episode published = publicationWorkflowService.publish(10L, 55L);

        assertThat(published.getPublishedAt()).isEqualTo(importedAt);
    }

    @Test
    void publishWithExplicitBackdatedPublishedAt() {
        Instant backdated = Instant.parse("2019-03-20T08:30:00Z");
        Episode episode = draftEpisode();
        episode.setPublishedAt(Instant.parse("2020-01-15T10:00:00Z"));
        episode.getFormats().add(activeFormat());
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");
        MediaAsset publicAudio = audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(true);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(episodeMediaApi.promoteToPublic(99L)).thenReturn(publicAudio);

        Episode published = publicationWorkflowService.publish(10L, 55L, false, backdated);

        assertThat(published.getPublishedAt()).isEqualTo(backdated);
    }

    @Test
    void publishRejectsFuturePublishedAt() {
        Episode episode = draftEpisode();
        episode.getFormats().add(activeFormat());
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(true);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);

        assertThatThrownBy(() -> publicationWorkflowService.publish(
                10L,
                55L,
                false,
                Instant.parse("2099-01-01T00:00:00Z")
        ))
                .isInstanceOf(InvalidPublicationTransitionException.class)
                .hasMessageContaining("publishedAt");
    }

    @Test
    void publishPaidEpisodeKeepsAudioPrivate() {
        Episode episode = draftEpisode();
        episode.setAccessPolicy(AccessPolicy.PAID);
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(false);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);

        Episode published = publicationWorkflowService.publish(10L, 55L);

        assertThat(published.getStatus()).isEqualTo(EpisodeStatus.PUBLISHED);
        assertThat(published.getAudioAsset().getVisibility()).isEqualTo(AssetVisibility.PRIVATE);
        verify(episodeMediaApi).attachEpisode(99L, 55L);
        verify(episodeMediaApi, never()).promoteToPublic(99L);
    }

    @Test
    void publishRequiresFormatWhenTenantHasActiveFormats() {
        Episode episode = draftEpisode();
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(formatService.hasActiveFormats(10L)).thenReturn(true);

        assertThatThrownBy(() -> publicationWorkflowService.publish(10L, 55L))
                .isInstanceOf(EpisodeValidationException.class)
                .hasMessageContaining("format");
    }

    @Test
    void publishRejectsInactiveAssignedFormat() {
        Episode episode = draftEpisode();
        Format inactiveFormat = activeFormat();
        inactiveFormat.setActive(false);
        episode.getFormats().add(inactiveFormat);
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(formatService.hasActiveFormats(10L)).thenReturn(false);

        assertThatThrownBy(() -> publicationWorkflowService.publish(10L, 55L))
                .isInstanceOf(EpisodeValidationException.class)
                .hasMessageContaining("format");
    }

    @Test
    void publishAllowsBlankDescription() {
        Episode episode = draftEpisode();
        episode.setDescription(null);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(formatService.hasActiveFormats(10L)).thenReturn(false);
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);

        Episode published = publicationWorkflowService.publish(10L, 55L);

        assertThat(published.getStatus()).isEqualTo(EpisodeStatus.PUBLISHED);
        assertThat(published.getDescription()).isEmpty();
    }

    @Test
    void scheduleAndCancelScheduleMoveBetweenDraftAndScheduled() {
        Episode episode = draftEpisode();
        Instant future = Instant.now().plusSeconds(3600);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        Episode scheduled = publicationWorkflowService.schedule(10L, 55L, future);

        assertThat(scheduled.getStatus()).isEqualTo(EpisodeStatus.SCHEDULED);
        assertThat(scheduled.getScheduledAt()).isEqualTo(future);

        Episode canceled = publicationWorkflowService.cancelSchedule(10L, 55L);

        assertThat(canceled.getStatus()).isEqualTo(EpisodeStatus.DRAFT);
        assertThat(canceled.getScheduledAt()).isNull();
    }

    @Test
    void unpublishDemotesPublicAudioBackToPrivate() {
        Episode episode = draftEpisode();
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setAudioAsset(audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3"));
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(episodeMediaApi.demoteToPrivate(99L)).thenReturn(privateAudio);

        Episode unpublished = publicationWorkflowService.unpublish(10L, 55L);

        assertThat(unpublished.getStatus()).isEqualTo(EpisodeStatus.DRAFT);
        assertThat(unpublished.getAudioAsset().getVisibility()).isEqualTo(AssetVisibility.PRIVATE);
        verify(episodeMediaApi).demoteToPrivate(99L);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void unpublishLeavesAlreadyPrivateAudioAlone() {
        Episode episode = draftEpisode();
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setAccessPolicy(AccessPolicy.PAID);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        Episode unpublished = publicationWorkflowService.unpublish(10L, 55L);

        assertThat(unpublished.getStatus()).isEqualTo(EpisodeStatus.DRAFT);
        verify(episodeMediaApi, never()).demoteToPrivate(any());
    }

    @Test
    void archiveDemotesPublicAudioBackToPrivate() {
        Episode episode = draftEpisode();
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setAudioAsset(audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3"));
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(episodeMediaApi.demoteToPrivate(99L)).thenReturn(privateAudio);

        Episode archived = publicationWorkflowService.archive(10L, 55L);

        assertThat(archived.getStatus()).isEqualTo(EpisodeStatus.ARCHIVED);
        assertThat(archived.getAudioAsset().getVisibility()).isEqualTo(AssetVisibility.PRIVATE);
        verify(episodeMediaApi).demoteToPrivate(99L);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void publishDueScheduledContinuesAfterFailureAndCountsOnlySuccessful() {
        when(episodeRepository.findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                eq(EpisodeStatus.SCHEDULED), any(Instant.class)))
                .thenReturn(List.of(dueEpisodeStub(10L, 55L), dueEpisodeStub(10L, 56L)));

        Episode failingEpisode = draftEpisode();
        failingEpisode.setStatus(EpisodeStatus.SCHEDULED);
        failingEpisode.setAudioAsset(null);

        Episode succeedingEpisode = draftEpisode();
        succeedingEpisode.setId(56L);
        succeedingEpisode.setStatus(EpisodeStatus.SCHEDULED);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(failingEpisode);
        when(episodeService.requireEpisode(10L, 56L)).thenReturn(succeedingEpisode);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(succeedingEpisode.getAudioAsset());
        when(formatService.hasActiveFormats(10L)).thenReturn(false);

        int published = publicationWorkflowService.publishDueScheduled();

        assertThat(published).isEqualTo(1);
        assertThat(succeedingEpisode.getStatus()).isEqualTo(EpisodeStatus.PUBLISHED);
        assertThat(failingEpisode.getStatus()).isEqualTo(EpisodeStatus.SCHEDULED);
        verify(episodeMediaApi).attachEpisode(99L, 56L);
    }

    @Test
    void scheduleRejectsNonDraftEpisode() {
        Episode episode = draftEpisode();
        episode.setStatus(EpisodeStatus.PUBLISHED);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        assertThatThrownBy(() -> publicationWorkflowService.schedule(10L, 55L, Instant.now().plusSeconds(3600)))
                .isInstanceOf(InvalidPublicationTransitionException.class);
    }

    @Test
    void publishRejectsEpisodeOfDraftSeries() {
        Episode episode = draftEpisode();
        episode.getSeries().setStatus(SeriesStatus.DRAFT);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        assertThatThrownBy(() -> publicationWorkflowService.publish(10L, 55L))
                .isInstanceOf(EpisodeValidationException.class)
                .hasMessageContaining("series");
        verify(episodeMediaApi, never()).requireReadyAudio(any());
    }

    @Test
    void scheduleRejectsEpisodeOfDraftSeries() {
        Episode episode = draftEpisode();
        episode.getSeries().setStatus(SeriesStatus.DRAFT);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        assertThatThrownBy(() -> publicationWorkflowService.schedule(10L, 55L, Instant.now().plusSeconds(3600)))
                .isInstanceOf(EpisodeValidationException.class)
                .hasMessageContaining("series");
        verify(episodeRepository, never()).save(any());
    }

    @Test
    void publishScheduledEpisodeSkipsWhenNoLongerScheduled() {
        Episode episode = draftEpisode();
        episode.setStatus(EpisodeStatus.DRAFT);

        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);

        publicationWorkflowService.publishScheduledEpisode(10L, 55L);

        assertThat(episode.getStatus()).isEqualTo(EpisodeStatus.DRAFT);
        verify(episodeMediaApi, never()).requireReadyAudio(any());
        verify(episodeRepository, never()).save(any());
    }

    @Test
    void publishDeniedForStrangerWithOwnOnlyRestriction() {
        Episode episode = draftEpisode();
        episode.setCreatedBy(99L);
        episode.getFormats().add(activeFormat());
        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        assertThatThrownBy(() -> publicationWorkflowService.publish(10L, 55L))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
        verify(episodeMediaApi, never()).requireReadyAudio(any());
    }

    @Test
    void publishAllowedForOwnerWithOwnOnlyRestriction() {
        Episode episode = draftEpisode();
        episode.setCreatedBy(5L);
        episode.getFormats().add(activeFormat());
        MediaAsset privateAudio = audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3");
        MediaAsset publicAudio = audio(99L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/audio/ep.mp3");
        episode.setAudioAsset(privateAudio);
        when(episodeService.requireEpisode(10L, 55L)).thenReturn(episode);
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.OTHERS_ONLY)));
        when(formatService.hasActiveFormats(10L)).thenReturn(true);
        when(episodeMediaApi.requireReadyAudio(99L)).thenReturn(privateAudio);
        when(episodeMediaApi.promoteToPublic(99L)).thenReturn(publicAudio);
        authenticate(5L, Role.EDITOR);

        Episode published = publicationWorkflowService.publish(10L, 55L);

        assertThat(published.getStatus()).isEqualTo(EpisodeStatus.PUBLISHED);
    }

    private static void authenticate(Long userId, Role... roles) {
        List<SimpleGrantedAuthority> authorities = Arrays.stream(roles)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId, "user@example.com", "hash", 10L, authorities);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }


    private static Episode draftEpisode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("main");
        series.setTitle("Main");
        series.setStatus(SeriesStatus.PUBLISHED);

        Episode episode = new Episode();
        episode.setId(55L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-1");
        episode.setTitle("Episode 1");
        episode.setDescription("<p>Show notes</p>");
        episode.setAudioAsset(audio(99L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/audio/ep.mp3"));
        episode.setAccessPolicy(AccessPolicy.FREE);
        episode.setStatus(EpisodeStatus.DRAFT);
        return episode;
    }

    private static Episode dueEpisodeStub(Long tenantId, Long episodeId) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        Episode episode = new Episode();
        episode.setId(episodeId);
        episode.setTenant(tenant);
        return episode;
    }

    private static Format activeFormat() {
        Format format = new Format();
        format.setId(1L);
        format.setSlug("main");
        format.setName("Main");
        format.setActive(true);
        return format;
    }

    private static MediaAsset audio(Long id, AssetVisibility visibility, AssetScope scope, String s3Key) {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        asset.setTenant(tenant);
        asset.setS3Key(s3Key);
        asset.setVisibility(visibility);
        asset.setScope(scope);
        asset.setAssetType(AssetType.AUDIO);
        asset.setStatus(AssetStatus.READY);
        return asset;
    }
}
