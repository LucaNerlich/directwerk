package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.modules.core.event.PasswordChangedEvent;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Memory-store counterpart to {@link PasswordChangedAuthorizationRevoker}.
 * Revokes via the principal-indexed {@link OAuth2AuthorizationService} wrapper
 * so refresh tokens do not survive a password change when
 * {@code authorization-store=memory} (#971).
 */
@Component
@ConditionalOnProperty(prefix = "directwerk.security", name = "authorization-store", havingValue = "memory")
public class MemoryPasswordChangedAuthorizationRevoker {

    private static final Logger log =
            LoggerFactory.getLogger(MemoryPasswordChangedAuthorizationRevoker.class);

    private final PrincipalIndexedOAuth2AuthorizationService authorizationService;

    public MemoryPasswordChangedAuthorizationRevoker(
            PrincipalIndexedOAuth2AuthorizationService authorizationService
    ) {
        this.authorizationService = authorizationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPasswordChanged(PasswordChangedEvent event) {
        Objects.requireNonNull(event.email());
        int removed = authorizationService.removeByPrincipalName(event.email());
        if (removed > 0) {
            log.info("Revoked {} OAuth2 authorization(s) after password change", removed);
        }
    }
}
