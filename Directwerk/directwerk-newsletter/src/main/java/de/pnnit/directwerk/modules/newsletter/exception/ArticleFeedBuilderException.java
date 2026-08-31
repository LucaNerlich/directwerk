package de.pnnit.directwerk.modules.newsletter.exception;

/**
 * Structured article feed-builder failure with an HTTP status and API {@code code}.
 */
public class ArticleFeedBuilderException extends RuntimeException {

    private final int status;
    private final String code;

    public ArticleFeedBuilderException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ArticleFeedBuilderException badRequest(String code, String message) {
        return new ArticleFeedBuilderException(400, code, message);
    }

    public static ArticleFeedBuilderException conflict(String code, String message) {
        return new ArticleFeedBuilderException(409, code, message);
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
