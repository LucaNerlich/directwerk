package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProdSecurityPropertiesValidatorTest {

    private static final String STRONG_SECRET = "a".repeat(32);

    @Mock
    private DirectwerkConfig directwerkConfig;

    private static DirectwerkProperties.Security security(
            String platformClientSecret, String tenantClientSecret) {
        return new DirectwerkProperties.Security(
                "https://api.example.com",
                "directwerk-api",
                "platform-client",
                "tenant-client",
                platformClientSecret,
                tenantClientSecret,
                "private-key",
                "public-key",
                "jdbc",
                null,
                null,
                null,
                null,
                List.of()
        );
    }

    @Test
    void rejectsMissingProductionSecrets() {
        when(directwerkConfig.security()).thenReturn(security("", STRONG_SECRET));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_PLATFORM_CLIENT_SECRET");
    }

    @Test
    void rejectsExposeDevTokensInProduction() {
        when(directwerkConfig.security()).thenReturn(security(STRONG_SECRET, STRONG_SECRET));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(true);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EXPOSE_DEV_TOKENS");
    }

    @Test
    void rejectsWeakPlatformClientSecret() {
        when(directwerkConfig.security()).thenReturn(security("too-short", STRONG_SECRET));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_PLATFORM_CLIENT_SECRET")
                .hasMessageContaining("32 characters");
    }

    @Test
    void allowsEmptyTrustedProxiesWithFrameworkForwardHeaders() {
        when(directwerkConfig.security()).thenReturn(security(STRONG_SECRET, STRONG_SECRET));
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);

        ProdSecurityPropertiesValidator validator = new ProdSecurityPropertiesValidator(directwerkConfig);

        validator.validateProductionSecurity();
    }
}
