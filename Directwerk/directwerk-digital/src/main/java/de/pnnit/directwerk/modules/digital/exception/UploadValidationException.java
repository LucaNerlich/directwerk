package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when an upload request fails validation (mime, size, filename, state).
 */
public class UploadValidationException extends RuntimeException {

    private final String code;

    public UploadValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public UploadValidationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
