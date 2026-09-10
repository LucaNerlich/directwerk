package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import de.pnnit.directwerk.modules.newsletter.service.ArticleImportService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ArticleRssBulkImportJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(ArticleRssBulkImportJobHandler.class);
    private static final int MAX_FAILED_TITLES = 10;

    private final ObjectMapper objectMapper;
    private final ArticleImportService articleImportService;
    private final TransactionalEmailService transactionalEmailService;

    public ArticleRssBulkImportJobHandler(
            ObjectMapper objectMapper,
            ArticleImportService articleImportService,
            TransactionalEmailService transactionalEmailService
    ) {
        this.objectMapper = objectMapper;
        this.articleImportService = articleImportService;
        this.transactionalEmailService = transactionalEmailService;
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

        ArticleImportService.Preview preview = articleImportService.preview(payload.feedUrl());
        if (preview.truncated()) {
            throw new ArticleRssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "A truncated RSS feed preview cannot be used for bulk import"
            );
        }
        int imported = 0;
        int skipped = 0;
        int failed = 0;
        List<String> failedTitles = new ArrayList<>();
        for (ArticleImportService.PreviewArticle article : preview.articles()) {
            if (article.alreadyImportedArticleId() != null) {
                skipped++;
                continue;
            }
            try {
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
                if (result.alreadyImported()) {
                    skipped++;
                } else {
                    imported++;
                }
            } catch (ArticleRssImportException ex) {
                failed++;
                log.warn("Bulk article RSS import failed for guid={} title={}",
                        article.guid(), article.title(), ex);
                if (failedTitles.size() < MAX_FAILED_TITLES) {
                    failedTitles.add(article.title() == null ? article.guid() : article.title());
                }
            }
        }

        String recipient = payload.requestedBy() == null || payload.requestedBy().isBlank()
                ? "there"
                : payload.requestedBy();
        transactionalEmailService.sendFromPayload(
                job.id(),
                job.tenantId(),
                payload.notifyEmail(),
                EmailTemplate.RSS_BULK_IMPORT_FINISHED,
                Map.of(
                        "recipientName", recipient,
                        "feedUrl", preview.feedUrl(),
                        "importedCount", String.valueOf(imported),
                        "skippedCount", String.valueOf(skipped),
                        "failedCount", String.valueOf(failed),
                        "failedDetails", failedTitles.isEmpty()
                                ? "All new articles imported cleanly."
                                : "Failed: " + String.join("; ", failedTitles)
                )
        );
        log.info("Bulk article RSS import finished tenant={} feed={} imported={} skipped={} failed={}",
                job.tenantId(), preview.feedUrl(), imported, skipped, failed);
    }
}
