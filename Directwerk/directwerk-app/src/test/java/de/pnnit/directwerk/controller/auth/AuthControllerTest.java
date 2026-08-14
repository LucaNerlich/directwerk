package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.service.EmailVerificationService;
import de.pnnit.directwerk.modules.core.service.InvitationAcceptanceService;
import de.pnnit.directwerk.modules.core.service.PasswordResetService;
import de.pnnit.directwerk.modules.core.service.UserAccountService;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserAccountService userAccountService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private PasswordResetService passwordResetService;

    @Mock
    private InvitationAcceptanceService invitationAcceptanceService;

    @Mock
    private EmailVerificationService emailVerificationService;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Test
    void forgotPasswordExposesResetTokenOnlyWhenConfigured() {
        when(passwordResetService.requestReset("user@example.com")).thenReturn("raw-reset-token");
        when(directwerkConfig.isExposeDevTokens()).thenReturn(true);
        AuthController controller = controller();

        ResponseEntity<Response<AuthController.ForgotPasswordResponse>> response =
                controller.forgotPassword(new AuthController.ForgotPasswordRequest("user@example.com"));

        assertThat(response.getBody().data().devResetToken()).isEqualTo("raw-reset-token");
    }

    @Test
    void forgotPasswordHidesResetTokenByDefault() {
        when(passwordResetService.requestReset("user@example.com")).thenReturn("raw-reset-token");
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);
        AuthController controller = controller();

        ResponseEntity<Response<AuthController.ForgotPasswordResponse>> response =
                controller.forgotPassword(new AuthController.ForgotPasswordRequest("user@example.com"));

        assertThat(response.getBody().data().devResetToken()).isNull();
    }

    private AuthController controller() {
        return new AuthController(
                userAccountService,
                tenantResolver,
                passwordResetService,
                invitationAcceptanceService,
                emailVerificationService,
                directwerkConfig
        );
    }
}
