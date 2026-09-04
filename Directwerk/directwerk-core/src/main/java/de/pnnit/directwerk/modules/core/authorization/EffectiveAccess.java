package de.pnnit.directwerk.modules.core.authorization;

/**
 * Effective access level of one (entity, operation) pair for dashboards and
 * studio UI adaptation. The backend still decides per row — {@code OWN_ONLY}
 * rights are granted for own content and refused for foreign content.
 */
public enum EffectiveAccess {
    FULL,
    OWN_ONLY,
    DENIED
}
