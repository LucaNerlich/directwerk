package de.pnnit.directwerk.modules.content;

/**
 * The lifecycle phase every publishable content type shares.
 *
 * <p>An episode, an article and a bonus file use different status enums, but
 * their lifecycle is the same four phases. Keeping the phase here lets one
 * transition table drive every module (and every API projection).</p>
 */
public enum PublicationPhase {
    DRAFT,
    SCHEDULED,
    PUBLISHED,
    ARCHIVED
}
