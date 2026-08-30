package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailLinkBuilderTest {

    private static final Long TENANT_ID = 42L;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private TenantPublicHostResolver tenantPublicHostResolver;

    @Mock
    private TenantRepository tenantRepository;

    private EmailLinkBuilder linkBuilder;

    @BeforeEach
    void setUp() {
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                "smtp",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004/",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        ));
        linkBuilder = new EmailLinkBuilder(directwerkConfig, tenantPublicHostResolver, tenantRepository);
    }

    @Test
    void buildStudioAcceptInviteUrlNormalizesBaseUrlAndEncodesToken() {
        String url = linkBuilder.buildStudioAcceptInviteUrl("token+value");

        assertThat(url).isEqualTo("http://localhost:3004/accept-invite?token=token%2Bvalue");
    }

    @Test
    void buildStudioAcceptInviteUrlUsesSharedStudioBaseEvenWhenTenantHasPrimaryDomain() {
        String url = linkBuilder.buildStudioAcceptInviteUrl("invite-token", TENANT_ID);

        assertThat(url).isEqualTo("http://localhost:3004/accept-invite?token=invite-token");
    }

    @Test
    void buildAdminAcceptInviteUrlUsesAdminBaseUrl() {
        String url = linkBuilder.buildAdminAcceptInviteUrl("invite-token");

        assertThat(url).isEqualTo("http://localhost:3001/accept-invite?token=invite-token");
    }

    @Test
    void buildResetPasswordUrlUsesStudioBaseUrl() {
        String url = linkBuilder.buildResetPasswordUrl("reset-token");

        assertThat(url).isEqualTo("http://localhost:3004/reset-password?token=reset-token");
    }

    @Test
    void buildVerifyEmailUrlEncodesToken() {
        String url = linkBuilder.buildVerifyEmailUrl("token+with spaces&special=chars");

        assertThat(url).isEqualTo("http://localhost:3004/verify-email?token=token%2Bwith+spaces%26special%3Dchars");
    }
}
