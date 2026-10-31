package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.ContentNotifyPreviewView;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.content.NewsletterNotificationApi;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import de.pnnit.directwerk.modules.email.repository.ContentNotificationMarkerRepository;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ContentNotifyStudioServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long EPISODE_ID = 55L;

    @Mock private SubscriberNotificationGate notificationGate;
    @Mock private TenantMembershipRepository tenantMembershipRepository;
    @Mock private NewsletterNotificationApi newsletterNotificationApi;
    @Mock private EpisodeRepository episodeRepository;
    @Mock private ArticleRepository articleRepository;
    @Mock private QueueService queueService;
    @Mock private PublicationWorkflowService episodePublicationWorkflow;
    @Mock private ArticlePublicationWorkflowService articlePublicationWorkflow;
    @Mock private ContentNotificationMarkerRepository contentNotificationMarkerRepository;

    @InjectMocks
    private ContentNotifyStudioService service;

    private Episode episode;

    @BeforeEach
    void setUp() {
        episode = new Episode();
        episode.setId(EPISODE_ID);
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setEmailNotifiedAt(Instant.parse("2026-10-01T12:00:00Z"));
        when(notificationGate.availableForTenant(TENANT_ID)).thenReturn(true);
    }

    private void stubEpisodeAudience() {
        when(episodeRepository.findByIdAndTenantId(EPISODE_ID, TENANT_ID)).thenReturn(Optional.of(episode));
        when(tenantMembershipRepository.countNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(42L);
    }

    @Test
    void previewEpisodeSurfacesAudienceAndFailedJobForRetry() {
        stubEpisodeAudience();
        UUID jobId = UUID.randomUUID();
        when(queueService.findLatestByCorrelation(
                eq(QueueNames.CONTENT_NOTIFY), eq(TENANT_ID), eq("content-notify-episode-55")))
                .thenReturn(Optional.of(job(jobId, JobStatus.FAILED, "boom")));

        ContentNotifyPreviewView preview = service.previewEpisode(TENANT_ID, EPISODE_ID);

        assertThat(preview.estimatedRecipients()).isEqualTo(42L);
        assertThat(preview.emailNotifiedAt()).isEqualTo(Instant.parse("2026-10-01T12:00:00Z"));
        assertThat(preview.jobId()).isEqualTo(jobId);
        assertThat(preview.jobStatus()).isEqualTo("FAILED");
        assertThat(preview.lastError()).isEqualTo("boom");
        assertThat(preview.notifyAvailable()).isTrue();
        assertThat(preview.canRetry()).isTrue();
    }

    @Test
    void previewEpisodeBlocksRetryWhileJobInFlight() {
        stubEpisodeAudience();
        when(queueService.findLatestByCorrelation(any(), anyLong(), any()))
                .thenReturn(Optional.of(job(UUID.randomUUID(), JobStatus.PROCESSING, null)));

        ContentNotifyPreviewView preview = service.previewEpisode(TENANT_ID, EPISODE_ID);

        assertThat(preview.canRetry()).isFalse();
    }

    @Test
    void previewEpisodeBlocksRetryWhenClaimRemainsAfterJobRetention() {
        // Successful send leaves emailNotifiedAt; COMPLETED job rows are purged by retention.
        stubEpisodeAudience();
        when(queueService.findLatestByCorrelation(any(), anyLong(), any())).thenReturn(Optional.empty());

        ContentNotifyPreviewView preview = service.previewEpisode(TENANT_ID, EPISODE_ID);

        assertThat(preview.emailNotifiedAt()).isNotNull();
        assertThat(preview.jobId()).isNull();
        assertThat(preview.canRetry()).isFalse();
    }

    @Test
    void retryEpisodeDelegatesWhenCanRetry() {
        stubEpisodeAudience();
        when(queueService.findLatestByCorrelation(any(), anyLong(), any()))
                .thenReturn(Optional.of(job(UUID.randomUUID(), JobStatus.FAILED, "boom")));
        when(episodePublicationWorkflow.notifySubscribersNow(TENANT_ID, EPISODE_ID)).thenReturn(episode);

        assertThat(service.retryEpisode(TENANT_ID, EPISODE_ID)).isSameAs(episode);
        verify(contentNotificationMarkerRepository)
                .clearForContent(TENANT_ID, "EPISODE", EPISODE_ID);
        verify(episodePublicationWorkflow).notifySubscribersNow(TENANT_ID, EPISODE_ID);
    }

    @Test
    void retryEpisodeRejectsCompletedNotify() {
        stubEpisodeAudience();
        when(queueService.findLatestByCorrelation(any(), anyLong(), any()))
                .thenReturn(Optional.of(job(UUID.randomUUID(), JobStatus.COMPLETED, null)));

        assertThatThrownBy(() -> service.retryEpisode(TENANT_ID, EPISODE_ID))
                .isInstanceOf(InvalidPublicationTransitionException.class);
    }

    @Test
    void previewArticleUsesDedupedRecipientCount() {
        Article article = new Article();
        article.setId(7L);
        article.setStatus(ArticleStatus.PUBLISHED);
        when(articleRepository.findByIdAndTenantId(7L, TENANT_ID)).thenReturn(Optional.of(article));
        when(newsletterNotificationApi.hasActiveArticleAudience(TENANT_ID, 7L)).thenReturn(true);
        when(newsletterNotificationApi.countArticleRecipients(TENANT_ID, 7L)).thenReturn(3L);
        when(queueService.findLatestByCorrelation(any(), anyLong(), any())).thenReturn(Optional.empty());

        ContentNotifyPreviewView preview = service.previewArticle(TENANT_ID, 7L);

        assertThat(preview.estimatedRecipients()).isEqualTo(3L);
        assertThat(preview.canRetry()).isTrue();
    }

    @Test
    void previewArticleTreatsDraftClearedAudienceAsNotRetryable() {
        Article article = new Article();
        article.setId(7L);
        article.setStatus(ArticleStatus.PUBLISHED);
        when(articleRepository.findByIdAndTenantId(7L, TENANT_ID)).thenReturn(Optional.of(article));
        when(newsletterNotificationApi.hasActiveArticleAudience(TENANT_ID, 7L)).thenReturn(false);
        when(newsletterNotificationApi.countArticleRecipients(TENANT_ID, 7L)).thenReturn(0L);
        when(queueService.findLatestByCorrelation(any(), anyLong(), any())).thenReturn(Optional.empty());

        ContentNotifyPreviewView preview = service.previewArticle(TENANT_ID, 7L);

        assertThat(preview.estimatedRecipients()).isZero();
        assertThat(preview.canRetry()).isFalse();
    }

    private static QueueJob job(UUID id, JobStatus status, String lastError) {
        return new QueueJob(
                id,
                QueueNames.CONTENT_NOTIFY,
                null,
                0,
                status,
                Instant.now(),
                1,
                5,
                null,
                null,
                lastError,
                TENANT_ID,
                "content-notify-episode-55",
                null,
                Instant.now(),
                Instant.now()
        );
    }
}
