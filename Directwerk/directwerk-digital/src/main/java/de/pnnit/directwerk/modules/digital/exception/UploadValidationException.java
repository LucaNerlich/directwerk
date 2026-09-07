package de.pnnit.directwerk.modules.digital.exception;

import de.pnnit.directwerk.modules.core.exception.CodedException;

/**
 * Thrown when an upload request fails validation (mime, size, filename, state).
 */
public class UploadValidationException extends CodedException {

    /**
     * Creates an exception with the specified error code and message.
     *
     * @param code    the error code
     * @param message the validation failure message
     */
    public UploadValidationException(String code, String message) {
        super(code, message);
    }

    /**
     * Creates an exception with an error code, message, and underlying cause.
     *
     * @param code    the error code
     * @param message the validation failure message
     * @param cause   the underlying cause
     */
    public UploadValidationException(String code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
