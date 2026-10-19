package de.pnnit.directwerk.modules.digital.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/**
 * Raised by the shared RSS reader when a feed cannot be parsed or lacks a channel
 * title. Module adapters translate it into their own import exception, keeping the
 * module-specific exception type on the public surface.
 */
public class RssFeedImportException extends CodedStatusException {

    /**
     * Creates an RSS import exception with an HTTP status, error code, and message.
     *
     * @param status  the HTTP status code
     * @param code    the error code
     * @param message the error message
     */
    public RssFeedImportException(int status, String code, String message) {
        super(status, code, message);
    }

    /**
     * Creates an RSS import exception with an HTTP status, error code, message, and cause.
     *
     * @param status  the HTTP status code
     * @param code    the error code
     * @param message the error message
     * @param cause   the underlying cause
     */
    public RssFeedImportException(int status, String code, String message, Throwable cause) {
        super(status, code, message, cause);
    }
}
