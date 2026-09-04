package de.pnnit.directwerk.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ReplaceRestrictionsRequest(
        @NotNull @Valid List<PermissionRestrictionView.Input> restrictions
) {
}
