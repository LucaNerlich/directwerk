package de.pnnit.directwerk.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import tools.jackson.databind.ObjectMapper;

class RssBulkImportJobHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PodcastImportService podcastImportService = mock(PodcastImportService.class);
    private final TransactionalEmailService emailService = mock(TransactionalEmailService.class);
    private final ImportRequesterResolver requesterResolver = mock(ImportRequesterResolver.class);
    private final RssBulkImportJobHandler handler = new RssBulkImportJobHandler(
            objectMapper, podcastImportService, emailService, requesterResolver);

    @BeforeEach
    void stubRequester() {
        when(requesterResolver.requireRequester(any(), any(), any())).thenReturn(requester());
    }

    @Test
    void importsNewEpisodesSkipsImportedAndEmailsSummary() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        when(podcastImportService.importEpisode(any())).thenAnswer(invocation -> new PodcastImportService.ImportedEpisode(
                mock(Episode.class), false));
        when(podcastImportService.importEpisode(argThat(cmd -> "guid-fails".equals(cmd.guid()))))
                .thenThrow(new RssImportException(400, "RSS_ITEM_INVALID", "boom"));

        handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(11L),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        )));

        var commands = ArgumentCaptor.forClass(PodcastImportService.ImportEpisodeCommand.class);
        verify(podcastImportService).preview("https://example.com/feed.xml");
        verify(podcastImportService, times(2)).importEpisode(commands.capture());
        assertThat(commands.getAllValues())
                .extracting(PodcastImportService.ImportEpisodeCommand::guid)
                .containsExactly("guid-new", "guid-fails");
        assertThat(commands.getAllValues().get(0).seriesId()).isEqualTo(3L);
        assertThat(commands.getAllValues().get(0).formatIds()).containsExactly(11L);

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
                .containsEntry("failedCount", "1")
                .containsEntry("recipientName", "Eddie");
        assertThat(emailVars.getValue().get("failedDetails").toString()).contains("Bad Episode");
    }

    @Test
    void unexpectedRuntimeExceptionPropagatesForJobRetry() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        when(podcastImportService.importEpisode(any()))
                .thenThrow(new IllegalStateException("storage down"));

        assertThatThrownBy(() -> handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        )))).isInstanceOf(IllegalStateException.class)
                .hasMessage("storage down");
    }

    @Test
    void aFailingRemoteAssetIsCountedInsteadOfAbortingTheRun() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        when(podcastImportService.importEpisode(any())).thenAnswer(invocation -> {
            PodcastImportService.ImportEpisodeCommand cmd = invocation.getArgument(0);
            if ("guid-new".equals(cmd.guid())) {
                throw new UploadValidationException("REMOTE_ASSET_FAILED", "Could not stream remote asset");
            }
            return new PodcastImportService.ImportedEpisode(mock(Episode.class), false);
        });

        handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        )));

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
    void honorsAudioAndImageFlags() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        when(podcastImportService.importEpisode(any()))
                .thenReturn(new PodcastImportService.ImportedEpisode(mock(Episode.class), false));

        handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.PAID,
                5,
                false,
                false,
                "editor@example.com",
                null,
                7L
        )));

        var commands = ArgumentCaptor.forClass(PodcastImportService.ImportEpisodeCommand.class);
        verify(podcastImportService, times(2)).importEpisode(commands.capture());
        var newEpisode = commands.getAllValues().stream()
                .filter(cmd -> "guid-new".equals(cmd.guid()))
                .findFirst()
                .orElseThrow();
        assertThat(newEpisode.audioUrl()).isNull();
        assertThat(newEpisode.imageUrl()).isNull();
        assertThat(newEpisode.accessPolicy()).isEqualTo(AccessPolicy.PAID);
        assertThat(newEpisode.requiredLevelSortOrder()).isEqualTo(5);
    }

    @Test
    void countsAnEpisodeImportedByAnotherRunAsSkipped() {
        // #747: the summary hardcoded IMPORTED and discarded ImportedEpisode.alreadyImported,
        // so a race with another import reported new episodes that were never added.
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        when(podcastImportService.importEpisode(any()))
                .thenAnswer(invocation -> new PodcastImportService.ImportedEpisode(
                        mock(Episode.class), true));

        handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        )));

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
                .containsEntry("importedCount", "0")
                .containsEntry("skippedCount", "3");
    }

    @Test
    void rejectsInvalidPayload() {
        assertThatThrownBy(() -> handler.handle(job(new RssBulkImportPayload(
                null, "", null, null, null, true, true, "", null, null))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsTruncatedPreviewWithoutImportingEpisodes() {
        PodcastImportService.Preview truncatedPreview = new PodcastImportService.Preview(
                preview().feedUrl(),
                preview().channel(),
                preview().episodes(),
                true
        );
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(truncatedPreview);

        assertThatThrownBy(() -> handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        ))))
                .isInstanceOf(RssImportException.class)
                .hasMessageContaining("truncated");

        verify(podcastImportService, never()).importEpisode(any());
        verify(emailService, never()).sendFromPayload(any(), any(), any(), any(), any());
    }

    @Test
    void runsTheImportAsTheRequestingEditorAndRestoresTheContext() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(preview());
        List<Long> creatorsSeenDuringImport = new ArrayList<>();
        when(podcastImportService.importEpisode(any())).thenAnswer(invocation -> {
            creatorsSeenDuringImport.add(SecurityUtils.currentUserId());
            return new PodcastImportService.ImportedEpisode(mock(Episode.class), false);
        });

        handler.handle(job(new RssBulkImportPayload(
                3L,
                "https://example.com/feed.xml",
                Set.of(),
                AccessPolicy.FREE,
                null,
                true,
                true,
                "editor@example.com",
                "Eddie",
                7L
        )));

        // #303: the gate fails closed, so the import has to run as the requesting editor — which
        // is also what stamps the imported drafts with a real creator.
        assertThat(creatorsSeenDuringImport).isNotEmpty().allMatch(id -> id.equals(7L));
        // ...and the identity must not leak into the next job a pooled worker thread picks up.
        assertThat(SecurityUtils.currentPrincipal()).isNull();
    }

    private static DirectwerkUserPrincipal requester() {
        return new DirectwerkUserPrincipal(
                7L, "editor@example.com", "hash", 10L,
                List.of(new SimpleGrantedAuthority("ROLE_EDITOR")));
    }

    private PodcastImportService.Preview preview() {
        return new PodcastImportService.Preview(
                "https://example.com/feed.xml",
                new PodcastImportService.PreviewChannel(
                        "Show", "About", "de", "News", null, null, "show"),
                List.of(
                        episode("guid-new", "New Episode", null),
                        episode("guid-old", "Old Episode", 44L),
                        episode("guid-fails", "Bad Episode", null)
                ),
                false
        );
    }

    private static PodcastImportService.PreviewEpisode episode(String guid, String title, Long existingId) {
        return new PodcastImportService.PreviewEpisode(
                guid,
                title,
                "Notes",
                Instant.parse("2026-07-20T12:00:00Z"),
                3600,
                1,
                "https://cdn.example.com/" + guid + ".mp3",
                "audio/mpeg",
                1234L,
                "https://cdn.example.com/" + guid + ".jpg",
                guid,
                existingId
        );
    }

    private QueueJob job(RssBulkImportPayload payload) {
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.PODCAST_RSS_BULK_IMPORT,
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
