package de.pnnit.directwerk.modules.podcast.exception;

public class RssImportException extends RuntimeException {

    private final String code;
    private final int status;

    public RssImportException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public RssImportException(int status, String code, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public int getStatus() {
        return status;
    }
}
