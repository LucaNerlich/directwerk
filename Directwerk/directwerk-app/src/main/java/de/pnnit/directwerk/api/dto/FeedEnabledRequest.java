package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.NotNull;

public record FeedEnabledRequest(@NotNull Boolean enabled) {
}
