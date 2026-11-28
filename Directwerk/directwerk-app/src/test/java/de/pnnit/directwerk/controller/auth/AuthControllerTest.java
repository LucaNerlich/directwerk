package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.service.EmailVerificationService;
import de.pnnit.directwerk.modules.core.service.InvitationAcceptanceService;
import de.pnnit.directwerk.modules.core.service.PasswordResetService;
import de.pnnit.directwerk.modules.core.service.UserAccountService;
import de.pnnit.directwerk.modules.core.util.PasswordPolicyException;
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
    private de.pnnit.directwerk.security.PasswordResetRateLimiter passwordResetRateLimiter;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Test
    void forgotPasswordExposesResetTokenOnlyWhenConfigured() {
        when(passwordResetRateLimiter.tryAcquire("user@example.com")).thenReturn(true);
        when(passwordResetService.requestReset("user@example.com")).thenReturn("raw-reset-token");
        when(directwerkConfig.isExposeDevTokens()).thenReturn(true);
        AuthController controller = controller();

        ResponseEntity<Response<AuthController.ForgotPasswordResponse>> response =
                controller.forgotPassword(new AuthController.ForgotPasswordRequest("user@example.com"));

        assertThat(response.getBody().data().devResetToken()).isEqualTo("raw-reset-token");
    }

    @Test
    void forgotPasswordHidesResetTokenByDefault() {
        when(passwordResetRateLimiter.tryAcquire("user@example.com")).thenReturn(true);
        when(passwordResetService.requestReset("user@example.com")).thenReturn("raw-reset-token");
        when(directwerkConfig.isExposeDevTokens()).thenReturn(false);
        AuthController controller = controller();

        ResponseEntity<Response<AuthController.ForgotPasswordResponse>> response =
                controller.forgotPassword(new AuthController.ForgotPasswordRequest("user@example.com"));

        assertThat(response.getBody().data().devResetToken()).isNull();
    }

    @Test
    void forgotPasswordOverTheAccountCeilingStillAnswersAcceptedWithoutResetting() {
        when(passwordResetRateLimiter.tryAcquire("user@example.com")).thenReturn(false);
        AuthController controller = controller();

        ResponseEntity<Response<AuthController.ForgotPasswordResponse>> response =
                controller.forgotPassword(new AuthController.ForgotPasswordRequest("user@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.ACCEPTED);
        assertThat(response.getBody().data().devResetToken()).isNull();
        org.mockito.Mockito.verify(passwordResetService, org.mockito.Mockito.never())
                .requestReset("user@example.com");
    }

    @Test
    void resetPasswordMapsAPolicyViolationToValidationError() {
        String password = "\u00E4".repeat(40);
        org.mockito.Mockito.doThrow(new PasswordPolicyException())
                .when(passwordResetService).resetPassword("raw-reset-token", password);
        AuthController controller = controller();

        ResponseEntity<Response<Void>> response = controller.resetPassword(
                new AuthController.ResetPasswordRequest("raw-reset-token", password));

        assertThat(response.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.getBody().errors().getFirst().message())
                .isEqualTo(PasswordPolicyException.MESSAGE);
    }

    private AuthController controller() {
        return new AuthController(
                userAccountService,
                tenantResolver,
                passwordResetService,
                invitationAcceptanceService,
                emailVerificationService,
                directwerkConfig,
                passwordResetRateLimiter
        );
    }
}
