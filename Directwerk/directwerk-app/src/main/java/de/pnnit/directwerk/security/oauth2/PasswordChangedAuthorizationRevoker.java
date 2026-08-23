package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.modules.core.event.PasswordChangedEvent;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Revokes stored OAuth2 authorizations (refresh tokens) when a user's password
 * credential changes. Without this, a refresh token stolen before the change
 * keeps yielding fresh access tokens until its natural expiry — defeating the
 * point of the reset. Access tokens are stateless JWTs and remain valid for at
 * most their short TTL; removing the authorization invalidates the refresh
 * path, which is the durable credential.
 */
@Component
public class PasswordChangedAuthorizationRevoker {

    private static final Logger log =
            LoggerFactory.getLogger(PasswordChangedAuthorizationRevoker.class);

    private final JdbcOperations jdbcOperations;

    public PasswordChangedAuthorizationRevoker(JdbcOperations jdbcOperations) {
        this.jdbcOperations = jdbcOperations;
    }

    /**
     * Runs after the committing transaction so authorizations are only removed
     * once the new credential is actually persisted.
     */
    @EventListener
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPasswordChanged(PasswordChangedEvent event) {
        Objects.requireNonNull(event.email());
        int removed = jdbcOperations.update(
                "DELETE FROM oauth2_authorization WHERE principal_name = ?",
                event.email()
        );
        if (removed > 0) {
            log.info("Revoked {} OAuth2 authorization(s) after password change", removed);
        }
    }
}
