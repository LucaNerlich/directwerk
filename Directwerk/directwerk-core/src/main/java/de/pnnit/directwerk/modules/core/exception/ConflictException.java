package de.pnnit.directwerk.modules.core.exception;

/**
 * A resource-level uniqueness conflict (slug, membership, registration) carrying the API
 * error code the handler should return. One typed exception for every "already exists"
 * failure mode, handled once in {@code GlobalExceptionHandler} — controllers no longer
 * catch-and-relabel generic {@link IllegalStateException}s.
 */
public class ConflictException extends RuntimeException {

    private final String code;

    public ConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
