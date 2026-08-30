package de.pnnit.directwerk.modules.core.service;

/**
 * Thrown when credentials are valid but the account has no active editor/admin studio membership.
 */
public class StudioAccessDeniedException extends RuntimeException {

    public StudioAccessDeniedException() {
        super("Für dieses Konto ist kein Studio-Zugang freigeschaltet.");
    }
}
