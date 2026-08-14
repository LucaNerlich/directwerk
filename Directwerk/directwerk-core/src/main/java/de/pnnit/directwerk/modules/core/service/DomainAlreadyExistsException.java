package de.pnnit.directwerk.modules.core.service;

public class DomainAlreadyExistsException extends RuntimeException {

    public DomainAlreadyExistsException(String host) {
        super("Domain already exists: " + host);
    }

    public DomainAlreadyExistsException(String host, Throwable cause) {
        super("Domain already exists: " + host, cause);
    }
}
