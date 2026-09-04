package de.pnnit.directwerk.modules.core.authorization;

/**
 * Content operations covered by the RBAC permission model (issue #148).
 * Reads are baseline-allowed for editors and can never be restricted, so list
 * and detail views stay coherent (no invisible rows).
 */
public enum ContentOperation {
    CREATE,
    READ,
    UPDATE,
    DELETE,
    PUBLISH,
    SCHEDULE,
    UNPUBLISH,
    ARCHIVE,
    UNARCHIVE,
    MOVE;

    /**
     * Whether an own-content-only restriction is meaningful for this operation.
     * Creating has no owner yet, and reads are never restricted.
     */
    public boolean supportsOwnOnlyScope() {
        return this != CREATE && this != READ;
    }

    /** Whether tenant admins may restrict this operation for editors. */
    public boolean restrictable() {
        return this != READ;
    }
}
