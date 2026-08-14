package de.pnnit.directwerk.modules.core.service;

public class CannotRevokeLastPlatformAdminException extends RuntimeException {

    /**
     * Creates an exception for an attempt to revoke the last platform administrator.
     *
     * @param userId the identifier of the platform administrator
     */
    public CannotRevokeLastPlatformAdminException(Long userId) {
        super("Cannot revoke the last platform admin: " + userId);
    }
}
