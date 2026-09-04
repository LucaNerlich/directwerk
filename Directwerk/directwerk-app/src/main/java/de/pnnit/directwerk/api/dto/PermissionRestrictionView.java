package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import jakarta.validation.constraints.NotNull;

public record PermissionRestrictionView(
        ContentEntityType entityType,
        ContentOperation operation,
        RestrictionScope scope
) {
    public record Input(
            @NotNull ContentEntityType entityType,
            @NotNull ContentOperation operation,
            @NotNull RestrictionScope scope
    ) {
    }
}
