package de.pnnit.directwerk.modules.newsletter.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/**
 * Structured article feed-builder failure with an HTTP status and API {@code code}.
 *
 * <p>Extends {@link CodedStatusException} so the shared handler answers the documented 4xx
 * instead of falling through to the catch-all 500.
 */
public class ArticleFeedBuilderException extends CodedStatusException {

    public ArticleFeedBuilderException(int status, String code, String message) {
        super(status, code, message);
    }

    public static ArticleFeedBuilderException badRequest(String code, String message) {
        return new ArticleFeedBuilderException(400, code, message);
    }

    public static ArticleFeedBuilderException conflict(String code, String message) {
        return new ArticleFeedBuilderException(409, code, message);
    }
}
