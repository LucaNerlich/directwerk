package de.pnnit.directwerk.modules.podcast.feed;

/**
 * Structured feed-builder failure with an HTTP status and API {@code code}.
 */
public class FeedBuilderException extends RuntimeException {

    private final int status;
    private final String code;

    public FeedBuilderException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static FeedBuilderException badRequest(String code, String message) {
        return new FeedBuilderException(400, code, message);
    }

    public static FeedBuilderException conflict(String code, String message) {
        return new FeedBuilderException(409, code, message);
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
