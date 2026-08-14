package de.pnnit.directwerk.modules.core.service;

public class CannotDeactivateLastAdminException extends RuntimeException {

    public CannotDeactivateLastAdminException(Long userId) {
        super("Cannot deactivate the last active tenant admin: " + userId);
    }
}
