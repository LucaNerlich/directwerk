package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * Bulk publish request. Mirrors {@link PublishOptionsRequest} for every id in
 * the list: optional subscriber notification fan-out and optional backdated
 * publication timestamp.
 */
public record BulkPublishRequest(
        @NotNull @Size(min = 1, max = BulkIdsRequest.MAX_IDS) List<@NotNull @Min(1) Long> ids,
        Boolean notifySubscribers,
        Instant publishedAt
) {
}
