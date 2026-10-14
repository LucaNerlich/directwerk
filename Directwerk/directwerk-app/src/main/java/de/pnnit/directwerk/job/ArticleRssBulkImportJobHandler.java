package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import de.pnnit.directwerk.modules.newsletter.service.ArticleImportService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Imports every not-yet-imported item of an article RSS feed with shared defaults.
 *
 * <p>Each item is imported in isolation: per-item failures are counted and
 * reported, never aborting the run. Imports are idempotent (feed-URL + GUID
 * identity), so a retried job cheaply skips finished work. A summary email goes
 * to the requester when the run completes.</p>
 */
@Component
public class ArticleRssBulkImportJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(ArticleRssBulkImportJobHandler.class);
    private static final BulkImportRun.Labels LABELS = new BulkImportRun.Labels(
            "Bulk article RSS import failed for",
            "All new articles imported cleanly.",
            "Bulk article RSS import finished"
    );

    private final ObjectMapper objectMapper;
    private final ArticleImportService articleImportService;
    private final TransactionalEmailService transactionalEmailService;
    private final ImportRequesterResolver importRequesterResolver;

    public ArticleRssBulkImportJobHandler(
            ObjectMapper objectMapper,
            ArticleImportService articleImportService,
            TransactionalEmailService transactionalEmailService,
            ImportRequesterResolver importRequesterResolver
    ) {
        this.objectMapper = objectMapper;
        this.articleImportService = articleImportService;
        this.transactionalEmailService = transactionalEmailService;
        this.importRequesterResolver = importRequesterResolver;
    }

    @Override
    public String queueName() {
        return QueueNames.ARTICLE_RSS_BULK_IMPORT;
    }

    @Override
    public void handle(QueueJob job) {
        ArticleRssBulkImportPayload payload =
                objectMapper.convertValue(job.payload(), ArticleRssBulkImportPayload.class);
        if (payload == null || payload.feedUrl() == null || payload.feedUrl().isBlank()
                || payload.notifyEmail() == null || payload.notifyEmail().isBlank()) {
            throw new IllegalArgumentException("Invalid article-rss-bulk-import job payload");
        }

        // #303: the import writes through RBAC-gated services, so it runs as the editor who
        // requested it — which also stamps the imported drafts with a real creator. Resolving the
        // requester first keeps an unresolvable job from fetching the feed at all.
        DirectwerkUserPrincipal requester = importRequesterResolver.requireRequester(
                job.tenantId(), payload.requestedByUserId(), payload.notifyEmail());
        SecurityUtils.runAs(requester, () -> importAll(job, payload));
    }

    private void importAll(QueueJob job, ArticleRssBulkImportPayload payload) {
        ArticleImportService.Preview preview = articleImportService.preview(payload.feedUrl());
        if (preview.truncated()) {
            throw new ArticleRssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "A truncated RSS feed preview cannot be used for bulk import"
            );
        }

        BulkImportRun.run(
                new BulkImportRun.RunContext(
                        job,
                        preview.feedUrl(),
                        payload.notifyEmail(),
                        payload.requestedBy(),
                        LABELS,
                        transactionalEmailService,
                        log
                ),
                preview.articles(),
                article -> article.alreadyImportedArticleId() != null,
                ArticleImportService.PreviewArticle::guid,
                ArticleImportService.PreviewArticle::title,
                ArticleRssImportException.class,
                article -> {
                    ArticleImportService.ImportedArticle result = articleImportService.importArticle(
                            new ArticleImportService.ImportArticleCommand(
                                    preview.feedUrl(),
                                    article.guid(),
                                    article.suggestedSlug(),
                                    article.title(),
                                    article.body(),
                                    article.excerpt(),
                                    payload.accessPolicy(),
                                    payload.requiredLevelSortOrder(),
                                    payload.categoryIds(),
                                    payload.importHero() ? article.imageUrl() : null,
                                    null,
                                    payload.importHero(),
                                    payload.importInlineImages(),
                                    article.publishedAt()
                            )
                    );
                    return result.alreadyImported()
                            ? BulkImportRun.Outcome.SKIPPED
                            : BulkImportRun.Outcome.IMPORTED;
                }
        );
    }
}
