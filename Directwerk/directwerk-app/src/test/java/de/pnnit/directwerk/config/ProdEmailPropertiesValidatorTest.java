package de.pnnit.directwerk.config;

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
}
