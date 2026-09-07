package de.pnnit.directwerk.modules.core.exception;

/** {@link CodedException} variant for exceptions that also carry their own HTTP status. */
public abstract class CodedStatusException extends CodedException {

    private final int status;

    protected CodedStatusException(int status, String code, String message) {
        super(code, message);
        this.status = status;
    }

    protected CodedStatusException(int status, String code, String message, Throwable cause) {
        super(code, message, cause);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
