package de.pnnit.directwerk.modules.core.authorization;

/**
 * A content-access checker bound to one entity type. Obtained from
 * {@link de.pnnit.directwerk.modules.core.service.MembershipPermissionService#gateFor(ContentEntityType)}.
 */
public interface ContentAccessGate {

    /**
     * @param operation attempted operation
     * @param ownerUserId creator of the target row, or {@code null} for creates and legacy rows
     * @throws de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException when refused
     */
    void require(ContentOperation operation, Long ownerUserId);
}
