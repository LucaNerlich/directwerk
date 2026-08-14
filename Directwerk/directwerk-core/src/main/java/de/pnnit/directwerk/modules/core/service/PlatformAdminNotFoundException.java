package de.pnnit.directwerk.modules.core.service;

public class PlatformAdminNotFoundException extends RuntimeException {

    /**
     * Creates an exception indicating that a platform administrator was not found for a user.
     *
     * @param userId the identifier of the user whose platform administrator record was not found
     */
    public PlatformAdminNotFoundException(Long userId) {
        super("Platform admin not found for user: " + userId);
    }
}
