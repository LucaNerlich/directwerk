package de.pnnit.directwerk.modules.queue;

import java.util.UUID;

public class JobNotFoundException extends RuntimeException {

    public JobNotFoundException(UUID id) {
        super("Queue job '%s' was not found.".formatted(id));
    }
}
