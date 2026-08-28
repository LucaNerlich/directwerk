package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.PublicationLifecycleSupport;
import de.pnnit.directwerk.modules.core.notification.PublicationNotificationSupport;
import de.pnnit.directwerk.modules.content.PublicationTexts;
import de.pnnit.directwerk.modules.content.ScheduledPublishing;
import de.pnnit.directwerk.modules.content.ScheduledPublishing.DueItem;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.content.PublicationTransitions;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticlePublicationWorkflowService {

    private final ArticleRepository articleRepository;
    private final ArticleService articleService;
    private final HtmlSanitizer htmlSanitizer;
    private final ModuleGateService moduleGateService;
    private final ScheduledPublicationExecutor scheduledPublicationExecutor;
    private final ContentPublishedNotifier contentPublishedNotifier;
    private final SubscriberNotificationGate notificationGate;
    private final ObjectProvider<ArticlePublicationWorkflowService> self;

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article publish(Long tenantId, Long articleId) {
        return publish(tenantId, articleId, false);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article publish(Long tenantId, Long articleId, boolean notifySubscribers) {
        Article article = articleService.requireArticle(tenantId, articleId);
        return publishInternal(tenantId, article, notifySubscribers);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article schedule(Long tenantId, Long articleId, Instant scheduledAt) {
        return schedule(tenantId, articleId, scheduledAt, false);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article schedule(Long tenantId, Long articleId, Instant scheduledAt, boolean notifySubscribers) {
        Article article = articleService.requireArticle(tenantId, articleId);
        PublicationLifecycleSupport.schedule(
                scheduledAt,
                notifySubscribers,
                () -> article.getStatus() == ArticleStatus.DRAFT,
                "articles",
                () -> {
                    article.setStatus(ArticleStatus.SCHEDULED);
                    article.setScheduledAt(scheduledAt);
                    article.setNotifySubscribersOnPublish(notifySubscribers);
                }
        );
        return articleRepository.save(article);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article cancelSchedule(Long tenantId, Long articleId) {
        Article article = articleService.requireArticle(tenantId, articleId);
        PublicationLifecycleSupport.cancelSchedule(
                () -> article.getStatus() == ArticleStatus.SCHEDULED,
                "articles",
                () -> {
                    article.setStatus(ArticleStatus.DRAFT);
                    article.setScheduledAt(null);
                }
        );
        return articleRepository.save(article);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article unpublish(Long tenantId, Long articleId) {
        Article article = articleService.requireArticle(tenantId, articleId);
        PublicationLifecycleSupport.unpublish(
                () -> article.getStatus() == ArticleStatus.PUBLISHED,
                "articles",
                () -> {
                    article.setStatus(ArticleStatus.DRAFT);
                    article.setPublishedAt(null);
                    article.setScheduledAt(null);
                },
                null
        );
        return articleRepository.save(article);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article archive(Long tenantId, Long articleId) {
        Article article = articleService.requireArticle(tenantId, articleId);
        PublicationTransitions.requirePublishedStatus(article.getStatus() == ArticleStatus.PUBLISHED, "articles");
        article.setStatus(ArticleStatus.ARCHIVED);
        article.setScheduledAt(null);
        return articleRepository.save(article);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article unarchive(Long tenantId, Long articleId) {
        Article article = articleService.requireArticle(tenantId, articleId);
        PublicationTransitions.requireArchivedStatus(article.getStatus() == ArticleStatus.ARCHIVED, "articles");
        article.setStatus(ArticleStatus.DRAFT);
        article.setPublishedAt(null);
        article.setScheduledAt(null);
        return articleRepository.save(article);
    }

    public int publishDueScheduled() {
        List<DueItem> dueItems = articleRepository.findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                ArticleStatus.SCHEDULED,
                Instant.now()
        ).stream()
                .map(article -> new DueItem(article.getTenant().getId(), article.getId()))
                .toList();
        ArticlePublicationWorkflowService proxy = self.getObject();
        return scheduledPublicationExecutor.publishDue(
                DigitalContentModule.KEY,
                dueItems,
                proxy::publishScheduledArticle,
                "articles"
        );
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public void publishScheduledArticle(Long tenantId, Long articleId) {
        Article article = articleService.requireArticle(tenantId, articleId);
        if (article.getStatus() != ArticleStatus.SCHEDULED) {
            log.info("Skipping scheduled publish for article={} tenant={} — status is no longer SCHEDULED ({})",
                    articleId, tenantId, article.getStatus());
            return;
        }
        publishInternal(tenantId, article, article.isNotifySubscribersOnPublish());
    }

    private Article publishInternal(Long tenantId, Article article, boolean notifySubscribers) {
        PublicationTransitions.requireDraftOrScheduled(
                article.getStatus() == ArticleStatus.DRAFT || article.getStatus() == ArticleStatus.SCHEDULED,
                "articles");
        if (article.getTitle() == null || article.getTitle().isBlank()) {
            throw new ArticleValidationException("Article title is required");
        }

        String sanitizedBody = htmlSanitizer.sanitize(article.getBody());
        if (PublicationTexts.isBlankHtml(sanitizedBody)) {
            throw new ArticleValidationException("Article body is required");
        }
        article.setBody(sanitizedBody);

        Instant now = Instant.now();
        article.setStatus(ArticleStatus.PUBLISHED);
        article.setPublishedAt(now);
        article.setScheduledAt(null);
        Article published = articleRepository.save(article);

        maybeNotifySubscribers(tenantId, published, notifySubscribers);
        return published;
    }

    private void maybeNotifySubscribers(Long tenantId, Article published, boolean notifySubscribers) {
        Instant notifiedAt = Instant.now();
        PublicationNotificationSupport.maybeNotify(
                tenantId,
                ContentType.ARTICLE,
                published.getId(),
                published.getTitle(),
                PublicationTexts.excerptOr(published.getExcerpt(), published.getBody()),
                published.getSlug(),
                published.getAccessPolicy().name(),
                notifySubscribers,
                notificationGate,
                contentPublishedNotifier,
                () -> articleRepository.claimEmailNotification(tenantId, published.getId(), notifiedAt),
                () -> published.setEmailNotifiedAt(notifiedAt)
        );
    }
}
