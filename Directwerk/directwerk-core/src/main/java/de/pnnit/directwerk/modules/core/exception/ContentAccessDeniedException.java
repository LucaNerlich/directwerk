package de.pnnit.directwerk.modules.core.exception;

/**
 * A content RBAC denial carrying the API error code the handler should return
 * (issue #148). The code tells integrators and the studio UI exactly why an
 * operation was refused; the message stays human-readable and English-first.
 */
public class ContentAccessDeniedException extends RuntimeException {

    /** Baseline or restriction denial (non-owner-independent). */
    public static final String OPERATION_DENIED_BY_POLICY = "OPERATION_DENIED_BY_POLICY";

    /** Own-content-only restriction hit on someone else's content. */
    public static final String NOT_CONTENT_OWNER = "NOT_CONTENT_OWNER";

    private final String code;
    private final String entityType;
    private final String operation;

    public ContentAccessDeniedException(String code, String entityType, String operation, String message) {
        super(message);
        this.code = code;
        this.entityType = entityType;
        this.operation = operation;
    }

    public String getCode() {
        return code;
    }

    public String getEntityType() {
        return entityType;
    }

    public String getOperation() {
        return operation;
    }
}
