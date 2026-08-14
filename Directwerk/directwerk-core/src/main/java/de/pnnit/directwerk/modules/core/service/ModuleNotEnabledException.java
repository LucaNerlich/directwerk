package de.pnnit.directwerk.modules.core.service;

public class ModuleNotEnabledException extends RuntimeException {

    public ModuleNotEnabledException(String moduleKey) {
        super("Module " + moduleKey + " is not active for this tenant");
    }
}
