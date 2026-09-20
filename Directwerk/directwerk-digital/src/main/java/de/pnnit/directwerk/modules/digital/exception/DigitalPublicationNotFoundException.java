package de.pnnit.directwerk.modules.digital.exception;

public class DigitalPublicationNotFoundException extends RuntimeException {

    public DigitalPublicationNotFoundException(Long id) {
        super("Digital publication not found: " + id);
    }
}
