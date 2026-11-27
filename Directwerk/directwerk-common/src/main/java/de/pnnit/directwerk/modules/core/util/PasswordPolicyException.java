package de.pnnit.directwerk.modules.core.util;

/**
 * A password that violates the write-time policy (at least 8 characters, at most 72 UTF-8 bytes).
 * Extends {@link IllegalArgumentException} so existing callers keep their contract, but token
 * endpoints can map it before blaming the token (#1022).
 */
public class PasswordPolicyException extends IllegalArgumentException {

    public static final String MESSAGE = "Password must be at least 8 characters and at most 72 bytes";

    public PasswordPolicyException() {
        super(MESSAGE);
    }
}
