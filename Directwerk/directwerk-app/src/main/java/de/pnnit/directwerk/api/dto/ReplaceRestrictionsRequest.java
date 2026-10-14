package de.pnnit.directwerk.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Issue #313/#318: bounded like {@link BulkIdsRequest} — the list is authoritative and each
 *  entry is persisted in one transaction. */
public record ReplaceRestrictionsRequest(
        @NotNull @Size(max = BulkIdsRequest.MAX_IDS) @Valid List<PermissionRestrictionView.Input> restrictions
) {
}
