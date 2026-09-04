package de.pnnit.directwerk.modules.core.authorization;

/**
 * Restriction scope for a per-editor permission override. Overrides are
 * deny-only: they can take rights away from the role baseline, never grant
 * beyond it, so privilege escalation is structurally impossible.
 */
public enum RestrictionScope {
    /** The operation is forbidden entirely. */
    DENY,
    /** The operation is allowed on the editor's own content only. */
    OTHERS_ONLY
}
