package de.pnnit.directwerk.modules.core.service;

public class CannotDeactivateSelfException extends RuntimeException {

    public CannotDeactivateSelfException(Long userId) {
        super("Cannot deactivate own tenant membership: " + userId);
    }
}
