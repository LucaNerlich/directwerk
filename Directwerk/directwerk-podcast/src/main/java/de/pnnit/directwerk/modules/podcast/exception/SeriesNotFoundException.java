package de.pnnit.directwerk.modules.podcast.exception;

public class SeriesNotFoundException extends RuntimeException {

    public SeriesNotFoundException(Long id) {
        super("Podcast series not found: " + id);
    }

    public SeriesNotFoundException(String slug) {
        super("Podcast series not found: " + slug);
    }
}
