package de.pnnit.directwerk.modules.core.exception;

/** {@link CodedException} variant for exceptions that also carry their own HTTP status. */
public abstract class CodedStatusException extends CodedException {

    private final int status;

    /**
     * Creates an exception with an HTTP status, error code, and message.
     *
     * @param status  the HTTP status code
     * @param code    the error code
     * @param message the error message
     */
    protected CodedStatusException(int status, String code, String message) {
        super(code, message);
        this.status = status;
    }

    /**
     * Creates an exception with an HTTP status, error code, message, and root cause.
     *
     * @param status the HTTP status code
     * @param code the error code
     * @param message the error message
     * @param cause the underlying cause
     */
    protected CodedStatusException(int status, String code, String message, Throwable cause) {
        super(code, message, cause);
        this.status = status;
    }

    /**
     * Gets the HTTP status associated with this exception.
     *
     * @return the HTTP status code
     */
    public int getStatus() {
        return status;
    }
}
