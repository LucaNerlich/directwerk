package de.pnnit.directwerk.multitenancy;

/**
 * Thrown when a JWT still claims platform-admin access but the DB no longer
 * grants it (revoked admin row or non-ACTIVE user). Used by the platform-admin
 * guard filter so revocation takes effect before access-token expiry.
 */
public class PlatformAdminAccessDeniedException extends RuntimeException {

    public PlatformAdminAccessDeniedException() {
        super("Platform administrator access is no longer valid");
    }
}
