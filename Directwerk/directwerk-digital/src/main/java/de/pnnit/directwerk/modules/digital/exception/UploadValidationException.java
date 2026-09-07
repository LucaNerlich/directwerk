package de.pnnit.directwerk.modules.digital.exception;

import de.pnnit.directwerk.modules.core.exception.CodedException;

/**
 * Thrown when an upload request fails validation (mime, size, filename, state).
 */
public class UploadValidationException extends CodedException {

    public UploadValidationException(String code, String message) {
        super(code, message);
    }

    public UploadValidationException(String code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
