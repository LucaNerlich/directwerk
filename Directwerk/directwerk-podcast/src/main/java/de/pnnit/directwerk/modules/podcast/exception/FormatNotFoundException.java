package de.pnnit.directwerk.modules.podcast.exception;

public class FormatNotFoundException extends RuntimeException {

    public FormatNotFoundException(Long id) {
        super("Format not found: " + id);
    }
}
