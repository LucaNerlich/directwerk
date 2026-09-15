package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import org.slf4j.Logger;

/**
 * Shared run loop for the podcast and article bulk RSS imports.
 *
 * <p>Owns the per-item counters, the {@value #MAX_FAILED_TITLES}-title failure
 * cap, the summary email and the completion log line. Kind-specific wording and
 * the item import call are supplied by each handler, so both pipelines stay in
 * lockstep without sharing a job payload type.</p>
 */
public final class BulkImportRun {

    private static final int MAX_FAILED_TITLES = 10;

    /**
     * Whether an item was newly imported or found already imported mid-run.
     */
    public enum Outcome {
        IMPORTED,
        SKIPPED
    }

    /**
     * Imports a single feed item.
     *
     * @param <T> the preview item type
     */
    @FunctionalInterface
    public interface ItemImporter<T> {

        /**
         * Imports one item.
         *
         * @param item the preview item
         * @return whether the item was imported or skipped
         */
        Outcome importItem(T item);
    }

    /**
     * Per-kind wording that differs between podcast episodes and articles.
     *
     * @param failureLogPrefix  the prefix of the per-item failure warning
     * @param cleanMessage      the summary message when nothing failed
     * @param finishedLogPrefix the prefix of the completion log line
     */
    public record Labels(
            String failureLogPrefix,
            String cleanMessage,
            String finishedLogPrefix
    ) {
    }

    /**
     * Everything a run needs that does not vary per item.
     *
     * @param job          the queue job being processed
     * @param feedUrl      the resolved feed URL
     * @param notifyEmail  the summary recipient
     * @param requestedBy  the requester name used in the greeting
     * @param labels       per-kind wording
     * @param emailService the transactional email service
     * @param log          the handler logger, so log categories are preserved
     */
    public record RunContext(
            QueueJob job,
            String feedUrl,
            String notifyEmail,
            String requestedBy,
            Labels labels,
            TransactionalEmailService emailService,
            Logger log
    ) {
    }

    private BulkImportRun() {
    }

    /**
     * Imports each not-yet-imported item, counts imported/skipped/failed, and
     * sends the summary email.
     *
     * <p>Each item is imported in isolation: a failure counts and is reported, but
     * never aborts the run. Failures of a type other than {@code caughtFailure}
     * propagate so the job is retried.</p>
     *
     * @param context         the run-wide inputs
     * @param items           the preview items
     * @param alreadyImported tests whether an item was imported before the job
     * @param guid            the item's GUID, used in failure reporting
     * @param title           the item's title, used in failure reporting
     * @param caughtFailure   the failure type counted and skipped; other types propagate
     * @param importer        performs the import for one item
     * @param <T>             the preview item type
     */
    public static <T> void run(
            RunContext context,
            List<T> items,
            Predicate<T> alreadyImported,
            Function<T, String> guid,
            Function<T, String> title,
            Class<? extends RuntimeException> caughtFailure,
            ItemImporter<T> importer
    ) {
        int imported = 0;
        int skipped = 0;
        int failed = 0;
        List<String> failedTitles = new ArrayList<>();
        for (T item : items) {
            if (alreadyImported.test(item)) {
                skipped++;
                continue;
            }
            try {
                if (importer.importItem(item) == Outcome.SKIPPED) {
                    skipped++;
                } else {
                    imported++;
                }
            } catch (RuntimeException ex) {
                if (!caughtFailure.isInstance(ex)) {
                    throw ex;
                }
                failed++;
                context.log().warn(
                        context.labels().failureLogPrefix() + " guid={} title={}",
                        guid.apply(item),
                        title.apply(item),
                        ex
                );
                if (failedTitles.size() < MAX_FAILED_TITLES) {
                    failedTitles.add(title.apply(item) == null ? guid.apply(item) : title.apply(item));
                }
            }
        }

        String recipient = context.requestedBy() == null || context.requestedBy().isBlank()
                ? "there"
                : context.requestedBy();
        context.emailService().sendFromPayload(
                context.job().id(),
                context.job().tenantId(),
                context.notifyEmail(),
                EmailTemplate.RSS_BULK_IMPORT_FINISHED,
                Map.of(
                        "recipientName", recipient,
                        "feedUrl", context.feedUrl(),
                        "importedCount", String.valueOf(imported),
                        "skippedCount", String.valueOf(skipped),
                        "failedCount", String.valueOf(failed),
                        "failedDetails", failedTitles.isEmpty()
                                ? context.labels().cleanMessage()
                                : "Failed: " + String.join("; ", failedTitles)
                )
        );
        context.log().info(
                context.labels().finishedLogPrefix() + " tenant={} feed={} imported={} skipped={} failed={}",
                context.job().tenantId(),
                context.feedUrl(),
                imported,
                skipped,
                failed
        );
    }
}
