package de.pnnit.directwerk.modules.core.exception;

/** Shared shape for exceptions that carry a structured API error code for {@code GlobalExceptionHandler}. */
public abstract class CodedException extends RuntimeException {

    private final String code;

    /**
     * Creates an exception with a structured error code and message.
     *
     * @param code    the structured API error code
     * @param message the exception message
     */
    protected CodedException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Creates an exception with an error code, message, and underlying cause.
     *
     * @param code    the structured API error code
     * @param message the exception message
     * @param cause   the underlying cause
     */
    protected CodedException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    /**
     * Retrieves the structured API error code.
     *
     * @return the error code
     */
    public String getCode() {
        return code;
    }
}
