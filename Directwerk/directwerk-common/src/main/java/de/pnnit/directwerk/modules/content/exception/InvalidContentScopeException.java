package de.pnnit.directwerk.modules.content.exception;

/**
 * Raised when a ProductAccessRule scope target does not exist for the tenant.
 */
public class InvalidContentScopeException extends RuntimeException {

    private final String scopeType;
    private final Long scopeId;

    public InvalidContentScopeException(String scopeType, Long scopeId, String message) {
        super(message);
        this.scopeType = scopeType;
        this.scopeId = scopeId;
    }

    public String scopeType() {
        return scopeType;
    }

    public Long scopeId() {
        return scopeId;
    }
}
