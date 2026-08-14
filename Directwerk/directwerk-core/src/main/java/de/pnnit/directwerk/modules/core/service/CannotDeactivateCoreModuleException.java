package de.pnnit.directwerk.modules.core.service;

public class CannotDeactivateCoreModuleException extends RuntimeException {

    public CannotDeactivateCoreModuleException(String moduleKey) {
        super("Core module cannot be deactivated: " + moduleKey);
    }
}
