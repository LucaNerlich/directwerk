package de.pnnit.directwerk.modules.podcast.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

public class RssImportException extends CodedStatusException {

    /**
     * Creates an RSS import exception with the specified status, error code, and message.
     *
     * @param status  the status associated with the exception
     * @param code    the error code
     * @param message the exception message
     */
    public RssImportException(int status, String code, String message) {
        super(status, code, message);
    }

    /**
     * Creates an exception with a status, error code, message, and underlying cause.
     *
     * @param status the status associated with the error
     * @param code the error code
     * @param message the error message
     * @param cause the underlying cause
     */
    public RssImportException(int status, String code, String message, Throwable cause) {
        super(status, code, message, cause);
    }
}
