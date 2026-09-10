package de.pnnit.directwerk.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.service.ArticleImportService;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

class ArticleRssBulkImportJobHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ArticleImportService articleImportService = mock(ArticleImportService.class);
    private final TransactionalEmailService emailService = mock(TransactionalEmailService.class);
    private final ArticleRssBulkImportJobHandler handler =
            new ArticleRssBulkImportJobHandler(objectMapper, articleImportService, emailService);

    @Test
    void importsNewArticlesSkipsImportedAndEmailsSummary() {
        when(articleImportService.preview("https://example.com/articles.xml")).thenReturn(preview());
        when(articleImportService.importArticle(any())).thenAnswer(invocation -> new ArticleImportService.ImportedArticle(
                mock(Article.class), false));
        when(articleImportService.importArticle(argThat(cmd -> "guid-fails".equals(cmd.guid()))))
                .thenThrow(new RuntimeException("boom"));

        handler.handle(job(new ArticleRssBulkImportPayload(
                "https://example.com/articles.xml",
                Set.of(11L),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie"
        )));

        var commands = ArgumentCaptor.forClass(ArticleImportService.ImportArticleCommand.class);
        verify(articleImportService).preview("https://example.com/articles.xml");
        verify(articleImportService, times(2)).importArticle(commands.capture());
        assertThat(commands.getAllValues())
                .extracting(ArticleImportService.ImportArticleCommand::guid)
                .containsExactly("guid-new", "guid-fails");
        assertThat(commands.getAllValues().get(0).categoryIds()).containsExactly(11L);
        assertThat(commands.getAllValues().get(0).importInlineImages()).isTrue();

        @SuppressWarnings("unchecked")
        var emailVars = ArgumentCaptor.forClass(Map.class);
        verify(emailService).sendFromPayload(
                any(UUID.class),
                eq(10L),
                eq("editor@example.com"),
                eq(EmailTemplate.RSS_BULK_IMPORT_FINISHED),
                emailVars.capture()
        );
        assertThat(emailVars.getValue())
                .containsEntry("importedCount", "1")
                .containsEntry("skippedCount", "1")
                .containsEntry("failedCount", "1");
    }

    @Test
    void queueNameIsArticleRssBulkImport() {
        assertThat(handler.queueName()).isEqualTo(QueueNames.ARTICLE_RSS_BULK_IMPORT);
    }

    private ArticleImportService.Preview preview() {
        return new ArticleImportService.Preview(
                "https://example.com/articles.xml",
                new ArticleImportService.PreviewChannel("Blog", null, "de", null, null, "blog"),
                List.of(
                        new ArticleImportService.PreviewArticle(
                                "guid-done", "Done", "<p>x</p>", null, Instant.parse("2026-01-01T00:00:00Z"),
                                null, "done", 99L),
                        new ArticleImportService.PreviewArticle(
                                "guid-new", "New", "<p>y</p>", "teaser", Instant.parse("2026-01-02T00:00:00Z"),
                                "https://cdn.example.com/a.jpg", "new", null),
                        new ArticleImportService.PreviewArticle(
                                "guid-fails", "Fails", "<p>z</p>", null, null, null, "fails", null)
                ),
                false
        );
    }

    private QueueJob job(ArticleRssBulkImportPayload payload) {
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.ARTICLE_RSS_BULK_IMPORT,
                objectMapper.valueToTree(payload),
                0,
                JobStatus.PROCESSING,
                now,
                0,
                5,
                null,
                null,
                null,
                10L,
                null,
                null,
                now,
                now
        );
    }
}
