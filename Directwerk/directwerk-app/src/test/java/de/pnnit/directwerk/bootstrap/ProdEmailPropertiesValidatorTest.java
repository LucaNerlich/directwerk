package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProdEmailPropertiesValidatorTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @InjectMocks
    private ProdEmailPropertiesValidator validator;

    @Test
    void skipsValidationWhenEmailDisabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(false);

        validator.validateProductionEmail();
    }

    @Test
    void rejectsMissingFromAddressWhenEmailEnabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(directwerkConfig.security()).thenReturn(new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                "platform-secret",
                "tenant-secret",
                null,
                null,
                "memory",
                null,
                null,
                null,
                null,
                null
        ));
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                true,
                "smtp",
                " ",
                "Directwerk",
                "https://studio.example.com",
                "https://admin.example.com",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        ));

        assertThatThrownBy(() -> validator.validateProductionEmail())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_EMAIL_FROM");
    }

    @Test
    void rejectsHttpStudioBaseUrlWhenEmailEnabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(directwerkConfig.security()).thenReturn(new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                "platform-secret",
                "tenant-secret",
                null,
                null,
                "memory",
                null,
                null,
                null,
                null,
                null
        ));
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                true,
                "smtp",
                "noreply@example.com",
                "Directwerk",
                "http://studio.example.com",
                "https://admin.example.com",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        ));

        assertThatThrownBy(() -> validator.validateProductionEmail())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_EMAIL_STUDIO_BASE_URL");
    }

    @Test
    void rejectsMissingOAuthSecretsWhenEmailEnabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(directwerkConfig.security()).thenReturn(new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                " ",
                "tenant-secret",
                null,
                null,
                "memory",
                null,
                null,
                null,
                null,
                null
        ));
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                true,
                "smtp",
                "noreply@example.com",
                "Directwerk",
                "https://studio.example.com",
                "https://admin.example.com",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        ));

        assertThatThrownBy(() -> validator.validateProductionEmail())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_PLATFORM_CLIENT_SECRET");
    }
}
