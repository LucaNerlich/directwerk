package de.pnnit.directwerk.modules.digital.job;

public record RemoteAssetIngestJobPayload(
        Long mediaAssetId,
        String sourceUrl,
        String filenameHint
) {
}
