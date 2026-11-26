package de.pnnit.directwerk.analytics;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Structured failure from the tenant analytics read path. */
@Getter
public class AnalyticsQueryException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public AnalyticsQueryException(String code, HttpStatus status, String message) {
        this(code, status, message, null);
    }

    public AnalyticsQueryException(String code, HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }
}
