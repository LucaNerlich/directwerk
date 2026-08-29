package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProdSecurityPropertiesValidatorTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Test
    void rejectsMissingProductionSecrets() {
        when(directwerkConfig.security()).thenReturn(new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                "",
                "tenant-secret",
                "private-key",
                "public-key",
                "jdbc",
                null,
                null,
                null,
                null,
                null
        ));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_PLATFORM_CLIENT_SECRET");
    }

    @Test
    void rejectsExposeDevTokensInProduction() {
        when(directwerkConfig.security()).thenReturn(new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                "platform-secret",
                "tenant-secret",
                "private-key",
                "public-key",
                "jdbc",
                null,
                null,
                null,
                null,
                null
        ));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(true);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EXPOSE_DEV_TOKENS");
    }
}
