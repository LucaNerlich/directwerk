package de.pnnit.directwerk.modules.digital.storage;

/**
 * Identity and location of one generated feed object (RSS or similar) in object storage.
 * {@code kind} is an opaque, caller-defined discriminator (e.g. a podcast or article feed
 * kind enum name) — this layer has no content-type knowledge.
 */
public record FeedSnapshotRef(
        Long tenantId,
        String tenantSlug,
        String objectKey,
        boolean privateFeed,
        String kind,
        long subjectId
) {
}
