package de.pnnit.directwerk.modules.podcast.exception;

public class EpisodeNotFoundException extends RuntimeException {

    public EpisodeNotFoundException(Long id) {
        super("Episode not found: " + id);
    }

    public EpisodeNotFoundException(String slug) {
        super("Episode not found: " + slug);
    }
}
