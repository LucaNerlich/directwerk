package de.pnnit.directwerk.modules.core.exception;

/** Shared shape for exceptions that carry a structured API error code for {@code GlobalExceptionHandler}. */
public abstract class CodedException extends RuntimeException {

    private final String code;

    protected CodedException(String code, String message) {
        super(message);
        this.code = code;
    }

    protected CodedException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
