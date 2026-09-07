package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Bulk request carrying only content ids. The list is deduplicated server-side;
 * at least one and at most {@value #MAX_IDS} ids are accepted per call so a
 * single request stays bounded in transaction time.
 */
public record BulkIdsRequest(
        @NotNull @Size(min = 1, max = BulkIdsRequest.MAX_IDS) List<@Min(1) Long> ids
) {
    public static final int MAX_IDS = 100;
}
