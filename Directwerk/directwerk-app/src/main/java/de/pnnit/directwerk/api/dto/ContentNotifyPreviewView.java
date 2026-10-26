package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Studio preview for “notify subscribers on publish”: audience size, last claim, and
 * content-notify job outcome so the checkbox is not a blind fire.
 */
public record ContentNotifyPreviewView(
        long estimatedRecipients,
        Instant emailNotifiedAt,
        UUID jobId,
        String jobStatus,
        String lastError,
        boolean notifyAvailable,
        boolean canRetry
) {
}
