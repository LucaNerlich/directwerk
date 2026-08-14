package de.pnnit.directwerk.modules.core.service;

public class CannotRevokeSelfException extends RuntimeException {

    /**
     * Creates an exception for an attempt to revoke the specified user's own platform admin access.
     *
     * @param userId the user's platform identifier
     */
    public CannotRevokeSelfException(Long userId) {
        super("Cannot revoke your own platform admin access: " + userId);
    }
}
