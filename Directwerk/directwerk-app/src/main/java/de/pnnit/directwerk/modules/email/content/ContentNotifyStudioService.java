package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.api.dto.ContentNotifyPreviewView;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.content.NewsletterNotificationApi;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Tenant/studio-facing notify preview and retry for EMAIL_NOTIFY. Reuses the content-notify
 * correlation id and publication claim — does not reimplement Mailgun or the fan-out handlers.
 */
@Service
@RequiredArgsConstructor
public class ContentNotifyStudioService {

    private final SubscriberNotificationGate notificationGate;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final NewsletterNotificationApi newsletterNotificationApi;
    private final EpisodeRepository episodeRepository;
    private final ArticleRepository articleRepository;
    private final QueueService queueService;
    private final PublicationWorkflowService episodePublicationWorkflow;
    private final ArticlePublicationWorkflowService articlePublicationWorkflow;

    @Transactional(readOnly = true)
    public ContentNotifyPreviewView previewEpisode(Long tenantId, Long episodeId) {
        Episode episode = episodeRepository.findByIdAndTenantId(episodeId, tenantId)
                .orElseThrow(() -> new EpisodeNotFoundException(episodeId));
        long recipients = tenantMembershipRepository.countNotificationOptedInMembers(
                tenantId, MembershipStatus.ACTIVE);
        return preview(
                tenantId,
                ContentType.EPISODE,
                episodeId,
                episode.getStatus() == EpisodeStatus.PUBLISHED,
                episode.getEmailNotifiedAt(),
                recipients,
                true
        );
    }

    @Transactional(readOnly = true)
    @RequiresModule(ArticlesModule.KEY)
    public ContentNotifyPreviewView previewArticle(Long tenantId, Long articleId) {
        Article article = articleRepository.findByIdAndTenantId(articleId, tenantId)
                .orElseThrow(() -> new ArticleNotFoundException(articleId));
        // Draft-overlaid lists (same as Studio / fan-out), not live joins alone.
        boolean audienceOk = newsletterNotificationApi.hasActiveArticleAudience(tenantId, articleId);
        long recipients = newsletterNotificationApi.countArticleRecipients(tenantId, articleId);
        return preview(
                tenantId,
                ContentType.ARTICLE,
                articleId,
                article.getStatus() == ArticleStatus.PUBLISHED,
                article.getEmailNotifiedAt(),
                recipients,
                audienceOk
        );
    }

    @Transactional
    public Episode retryEpisode(Long tenantId, Long episodeId) {
        ContentNotifyPreviewView preview = previewEpisode(tenantId, episodeId);
        requireRetryable(preview);
        // Do not clear per-recipient markers: claim-after-successful-enqueue already leaves
        // failed/null enqueue unmarked, and wiping markers on Studio retry remelts the whole
        // audience (#949 review). Already-marked recipients stay skipped on re-fan-out.
        return episodePublicationWorkflow.notifySubscribersNow(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article retryArticle(Long tenantId, Long articleId) {
        ContentNotifyPreviewView preview = previewArticle(tenantId, articleId);
        requireRetryable(preview);
        return articlePublicationWorkflow.notifySubscribersNow(tenantId, articleId);
    }

    private ContentNotifyPreviewView preview(
            Long tenantId,
            ContentType contentType,
            Long contentId,
            boolean published,
            java.time.Instant emailNotifiedAt,
            long estimatedRecipients,
            boolean audienceOk
    ) {
        boolean notifyAvailable = notificationGate.availableForTenant(tenantId);
        Optional<QueueJob> job = queueService.findLatestByCorrelation(
                QueueNames.CONTENT_NOTIFY,
                tenantId,
                correlationId(contentType, contentId)
        );
        String jobStatus = job.map(QueueJob::status).map(Enum::name).orElse(null);
        String lastError = job.map(QueueJob::lastError)
                .filter(StringUtils::hasText)
                .map(error -> error.length() > 500 ? error.substring(0, 500) : error)
                .orElse(null);
        boolean inFlight = job.map(QueueJob::status)
                .map(status -> status == JobStatus.QUEUED || status == JobStatus.PROCESSING)
                .orElse(false);
        boolean failed = job.map(QueueJob::status).map(status -> status == JobStatus.FAILED).orElse(false);
        // emailNotifiedAt + missing job is the normal post-retention shape for a successful
        // send (COMPLETED rows are purged). Do not treat that as retryable — only never-sent
        // or an extant FAILED job.
        boolean neverSent = emailNotifiedAt == null;
        boolean canRetry = notifyAvailable
                && published
                && audienceOk
                && !inFlight
                && (failed || neverSent);
        return new ContentNotifyPreviewView(
                estimatedRecipients,
                emailNotifiedAt,
                job.map(QueueJob::id).orElse(null),
                jobStatus,
                lastError,
                notifyAvailable,
                canRetry
        );
    }

    private static void requireRetryable(ContentNotifyPreviewView preview) {
        if (!preview.canRetry()) {
            throw new InvalidPublicationTransitionException(
                    "Subscriber notification cannot be retried in the current state");
        }
    }

    private static String correlationId(ContentType contentType, Long contentId) {
        return "content-notify-%s-%d".formatted(contentType.name().toLowerCase(Locale.ROOT), contentId);
    }
}
