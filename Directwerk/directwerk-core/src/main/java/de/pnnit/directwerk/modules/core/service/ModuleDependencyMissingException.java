package de.pnnit.directwerk.modules.core.service;

public class ModuleDependencyMissingException extends RuntimeException {

    public ModuleDependencyMissingException(String moduleKey, String missingDependency) {
        super("Module " + moduleKey + " requires active dependency " + missingDependency);
    }
}
