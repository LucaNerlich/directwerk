package de.pnnit.directwerk.modules.queue;

public class JobConflictException extends RuntimeException {

    /**
     * Creates an exception with the specified detail message.
     *
     * @param message the detail message
     */
    public JobConflictException(String message) {
        super(message);
    }
}
