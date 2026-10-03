package de.pnnit.directwerk.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.event.PasswordChangedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcOperations;

@ExtendWith(MockitoExtension.class)
class PasswordChangedAuthorizationRevokerTest {

    @Mock
    private JdbcOperations jdbcOperations;

    @Test
    void deletesAllAuthorizationsForPrincipalEmail() {
        PasswordChangedAuthorizationRevoker revoker =
                new PasswordChangedAuthorizationRevoker(jdbcOperations);
        when(jdbcOperations.update(
                        eq("DELETE FROM oauth2_authorization WHERE principal_name = ?"),
                        eq("user@example.com")
                ))
                .thenReturn(2);

        revoker.onPasswordChanged(new PasswordChangedEvent("user@example.com", 42L));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> principal = ArgumentCaptor.forClass(Object.class);
        verify(jdbcOperations).update(sql.capture(), principal.capture());
        assertThat(sql.getValue()).isEqualTo("DELETE FROM oauth2_authorization WHERE principal_name = ?");
        assertThat(principal.getValue()).isEqualTo("user@example.com");
    }
}
