package de.pnnit.directwerk.api.dto;

import java.time.Instant;

public record PublishOptionsRequest(Boolean notifySubscribers, Instant publishedAt) {
}
