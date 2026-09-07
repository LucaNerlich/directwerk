package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/**
 * Structured feed-builder failure with an HTTP status and API {@code code}.
 */
public class FeedBuilderException extends CodedStatusException {

    public FeedBuilderException(int status, String code, String message) {
        super(status, code, message);
    }

    public static FeedBuilderException badRequest(String code, String message) {
        return new FeedBuilderException(400, code, message);
    }

    public static FeedBuilderException conflict(String code, String message) {
        return new FeedBuilderException(409, code, message);
    }
}
