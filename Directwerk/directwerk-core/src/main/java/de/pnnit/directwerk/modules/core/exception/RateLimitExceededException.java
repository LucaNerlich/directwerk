package de.pnnit.directwerk.modules.core.exception;

/**
 * Raised when a per-account or per-IP rate limit is exceeded on a controller path that
 * cannot be limited by a servlet filter (for example because the key lives in a JSON body).
 */
public class RateLimitExceededException extends CodedStatusException {

    public RateLimitExceededException() {
        super(429, "RATE_LIMIT_EXCEEDED", "Too many requests");
    }
}
