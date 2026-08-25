package de.pnnit.directwerk.api.dto;

import java.time.Instant;
import java.util.Map;

public record UploadUrlResponse(
        Long assetId,
        String uploadUrl,
        Instant expiresAt,
        Map<String, String> headers
) {
}
