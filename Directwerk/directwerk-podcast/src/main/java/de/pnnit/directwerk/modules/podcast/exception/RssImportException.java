package de.pnnit.directwerk.modules.podcast.exception;

public class RssImportException extends RuntimeException {

    private final String code;
    private final int status;

    /**
     * Creates an RSS import exception with an HTTP-like status, error code, and message.
     *
     * @param status  the HTTP-like status associated with the error
     * @param code    the application-specific error code
     * @param message the detail message
     */
    public RssImportException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /**
     * Creates an RSS import exception with a status, error code, message, and cause.
     *
     * @param status  the numeric status associated with the error
     * @param code    the error code
     * @param message the error message
     * @param cause   the underlying cause
     */
    public RssImportException(int status, String code, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
    }

    /**
     * Gets the error code associated with this exception.
     *
     * @return the error code
     */
    public String getCode() {
        return code;
    }

    /**
     * Retrieves the error status associated with this exception.
     *
     * @return the error status
     */
    public int getStatus() {
        return status;
    }
}
