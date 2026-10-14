package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

/** Issue #318: bounded like {@link BulkIdsRequest} so one request cannot amplify into
 *  unbounded per-id DB lookups inside a single transaction. */
public record ReplaceCategoriesRequest(
        @NotNull @Size(max = BulkIdsRequest.MAX_IDS) Set<@Min(1) Long> categoryIds
) {
}
