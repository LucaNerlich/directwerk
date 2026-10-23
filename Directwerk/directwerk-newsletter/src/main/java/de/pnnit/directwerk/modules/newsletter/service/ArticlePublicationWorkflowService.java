package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.PublicationTexts;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.content.PublicationWorkflow;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.newsletter.job.ArticleRssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.time.Instant;
import java.util.List;
import java.util.function.BiConsumer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Newsletter binding of {@link PublicationWorkflow}: article loading, body
 * validation, the newsletter-list notification gate and the article feed refresh.
 */
@Service
public class ArticlePublicationWorkflowService extends PublicationWorkflow<Article, ArticleStatus> {

    private final ArticleRepository articleRepository;
    private final ArticleService articleService;
    private final HtmlSanitizer htmlSanitizer;
    private final ArticleRssFeedRefreshJobProducer articleRssFeedRefreshScheduler;
    private final ObjectProvider<ArticlePublicationWorkflowService> self;

    public ArticlePublicationWorkflowService(
            ArticleRepository articleRepository,
            ArticleService articleService,
            HtmlSanitizer htmlSanitizer,
            ScheduledPublicationExecutor scheduledPublicationExecutor,
            ContentPublishedNotifier contentPublishedNotifier,
            SubscriberNotificationGate notificationGate,
            ArticleRssFeedRefreshJobProducer articleRssFeedRefreshScheduler,
            ObjectProvider<ArticlePublicationWorkflowService> self,
            MembershipPermissionService permissionService
    ) {
        super(scheduledPublicationExecutor, contentPublishedNotifier, notificationGate, permissionService);
        this.articleRepository = articleRepository;
        this.articleService = articleService;
        this.htmlSanitizer = htmlSanitizer;
        this.articleRssFeedRefreshScheduler = articleRssFeedRefreshScheduler;
        this.self = self;
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article publish(Long tenantId, Long articleId) {
        return publish(tenantId, articleId, false);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article publish(Long tenantId, Long articleId, boolean notifySubscribers) {
        return publish(tenantId, articleId, notifySubscribers, null);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article publish(Long tenantId, Long articleId, boolean notifySubscribers, Instant publishedAt) {
        return publishContent(tenantId, articleId, notifySubscribers, publishedAt);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article schedule(Long tenantId, Long articleId, Instant scheduledAt) {
        return schedule(tenantId, articleId, scheduledAt, false);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article schedule(Long tenantId, Long articleId, Instant scheduledAt, boolean notifySubscribers) {
        return scheduleContent(tenantId, articleId, scheduledAt, notifySubscribers);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article cancelSchedule(Long tenantId, Long articleId) {
        return cancelScheduleContent(tenantId, articleId);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article unpublish(Long tenantId, Long articleId) {
        return unpublishContent(tenantId, articleId, true);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article archive(Long tenantId, Long articleId) {
        return archiveContent(tenantId, articleId);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article unarchive(Long tenantId, Long articleId) {
        return unarchiveContent(tenantId, articleId);
    }

    public int publishDueScheduled() {
        return publishDueScheduledContent();
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public void publishScheduledArticle(Long tenantId, Long articleId) {
        publishScheduledContent(tenantId, articleId);
    }

    /**
     * Publishes every id in a single transaction with a single RSS refresh.
     * The call is atomic: the first failure (unknown id, wrong status,
     * validation) rolls back all changes and surfaces that item's error.
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public List<Article> bulkPublish(
            Long tenantId,
            List<Long> articleIds,
            boolean notifySubscribers,
            Instant publishedAt
    ) {
        return bulkPublishContent(tenantId, articleIds, notifySubscribers, publishedAt);
    }

    /**
     * Unpublishes every id in a single transaction with a single RSS refresh.
     * Atomic like {@link #bulkPublish(Long, List, boolean, Instant)}.
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public List<Article> bulkUnpublish(Long tenantId, List<Long> articleIds) {
        return bulkUnpublishContent(tenantId, articleIds);
    }

    @Override
    protected Article requireEntity(Long tenantId, Long contentId) {
        return articleService.requireArticle(tenantId, contentId);
    }

    @Override
    protected Article save(Article entity) {
        return articleRepository.save(entity);
    }

    @Override
    protected List<Article> findDueScheduled(Instant now) {
        return articleRepository.findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                ArticleStatus.SCHEDULED,
                now
        );
    }

    @Override
    protected Phase phaseOf(ArticleStatus status) {
        return switch (status) {
            case DRAFT -> Phase.DRAFT;
            case SCHEDULED -> Phase.SCHEDULED;
            case PUBLISHED -> Phase.PUBLISHED;
            case ARCHIVED -> Phase.ARCHIVED;
        };
    }

    @Override
    protected ArticleStatus statusFor(Phase phase) {
        return switch (phase) {
            case DRAFT -> ArticleStatus.DRAFT;
            case SCHEDULED -> ArticleStatus.SCHEDULED;
            case PUBLISHED -> ArticleStatus.PUBLISHED;
            case ARCHIVED -> ArticleStatus.ARCHIVED;
        };
    }

    @Override
    protected void requirePermission(ContentOperation operation, Article article) {
        permissionService.requireArticleAccess(operation, article.getCreatedBy());
    }

    @Override
    protected void validateAndPrepareForPublish(Long tenantId, Article article) {
        if (article.getTitle() == null || article.getTitle().isBlank()) {
            throw new ArticleValidationException("Article title is required");
        }

        String sanitizedBody = htmlSanitizer.sanitize(article.getBody());
        if (PublicationTexts.isBlankHtml(sanitizedBody)) {
            throw new ArticleValidationException("Article body is required");
        }
        article.setBody(sanitizedBody);
    }

    @Override
    protected String notificationExcerpt(Article article) {
        return PublicationTexts.excerptOr(article.getExcerpt(), article.getBody());
    }

    @Override
    protected boolean shouldNotify(Article article, boolean notifySubscribers) {
        return notifySubscribers && !article.getNewsletterLists().isEmpty();
    }

    @Override
    protected String accessPolicyName(Article article) {
        return article.getAccessPolicy().name();
    }

    @Override
    protected int claimEmailNotification(Long tenantId, Long contentId, Instant notifiedAt) {
        return articleRepository.claimEmailNotification(tenantId, contentId, notifiedAt);
    }

    @Override
    protected void requestFeedRefresh(Long tenantId) {
        articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
    }

    @Override
    protected String moduleKey() {
        return ArticlesModule.KEY;
    }

    @Override
    protected String pluralLabel() {
        return "articles";
    }

    @Override
    protected String singularLabel() {
        return "article";
    }

    @Override
    protected ContentType contentType() {
        return ContentType.ARTICLE;
    }

    @Override
    protected ContentEntityType entityType() {
        return ContentEntityType.ARTICLE;
    }

    @Override
    protected BiConsumer<Long, Long> scheduledPublisher() {
        return self.getObject()::publishScheduledArticle;
    }
}
