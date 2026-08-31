package de.pnnit.directwerk.modules.queue;

public class JobConflictException extends RuntimeException {

    public JobConflictException(String message) {
        super(message);
    }
}
