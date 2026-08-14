package de.pnnit.directwerk.modules.queue;

import java.util.UUID;

public class JobNotFoundException extends RuntimeException {

    /**
     * Creates an exception for a queue job that could not be found.
     *
     * @param id the identifier of the missing queue job
     */
    public JobNotFoundException(UUID id) {
        super("Queue job '%s' was not found.".formatted(id));
    }
}
