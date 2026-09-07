package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/**
 * Structured feed-builder failure with an HTTP status and API {@code code}.
 */
public class FeedBuilderException extends CodedStatusException {

    /**
     * Creates a feed-builder exception with an HTTP status, API code, and message.
     *
     * @param status  the HTTP status
     * @param code    the API error code
     * @param message the error message
     */
    public FeedBuilderException(int status, String code, String message) {
        super(status, code, message);
    }

    /**
     * Creates an exception representing a bad request.
     *
     * @param code    the API error code
     * @param message the error message
     * @return        a bad-request exception with HTTP status 400
     */
    public static FeedBuilderException badRequest(String code, String message) {
        return new FeedBuilderException(400, code, message);
    }

    /**
     * Creates an exception for a feed-builder conflict.
     *
     * @param code    the API error code
     * @param message the error message
     * @return        a feed-builder exception with HTTP status 409
     */
    public static FeedBuilderException conflict(String code, String message) {
        return new FeedBuilderException(409, code, message);
    }
}
