package de.pnnit.directwerk.security.oauth2;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.event.PasswordChangedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MemoryPasswordChangedAuthorizationRevokerTest {

    @Mock
    private PrincipalIndexedOAuth2AuthorizationService authorizationService;

    @Test
    void revokesAuthorizationsForPrincipalEmail() {
        MemoryPasswordChangedAuthorizationRevoker revoker =
                new MemoryPasswordChangedAuthorizationRevoker(authorizationService);
        when(authorizationService.removeByPrincipalName("user@example.com")).thenReturn(2);

        revoker.onPasswordChanged(new PasswordChangedEvent("user@example.com", 42L));

        verify(authorizationService).removeByPrincipalName("user@example.com");
    }
}
