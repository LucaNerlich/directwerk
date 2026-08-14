package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.EmailVerificationService;
import de.pnnit.directwerk.modules.core.service.InvitationAcceptanceService;
import de.pnnit.directwerk.modules.core.service.PasswordResetService;
import de.pnnit.directwerk.modules.core.service.UserAccountService;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserAccountService userAccountService;
    private final TenantResolver tenantResolver;
    private final PasswordResetService passwordResetService;
    private final InvitationAcceptanceService invitationAcceptanceService;
    private final EmailVerificationService emailVerificationService;
    private final DirectwerkConfig directwerkConfig;

    /**
     * Creates an authentication controller with the services and configuration required by its endpoints.
     *
     * @param userAccountService service for user registration
     * @param tenantResolver service for resolving tenants from requests
     * @param passwordResetService service for password reset operations
     * @param invitationAcceptanceService service for accepting invitations
     * @param directwerkConfig application configuration
     */
    public AuthController(
            UserAccountService userAccountService,
            TenantResolver tenantResolver,
            PasswordResetService passwordResetService,
            InvitationAcceptanceService invitationAcceptanceService,
            EmailVerificationService emailVerificationService,
            DirectwerkConfig directwerkConfig
    ) {
        this.userAccountService = userAccountService;
        this.tenantResolver = tenantResolver;
        this.passwordResetService = passwordResetService;
        this.invitationAcceptanceService = invitationAcceptanceService;
        this.emailVerificationService = emailVerificationService;
        this.directwerkConfig = directwerkConfig;
    }

    /**
     * Registers a user for the tenant associated with the request host.
     *
     * @param body    the user's registration details
     * @param request the HTTP request used to resolve the tenant
     * @return the created user's identifier and email, or a conflict response if the user already exists
     * @throws de.pnnit.directwerk.multitenancy.TenantNotFoundException if no tenant matches the request host
     */
    @PostMapping("/register")
    ResponseEntity<Response<RegisterResponse>> register(
            @Valid @RequestBody RegisterRequest body,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireActiveHost(request.getServerName());

        try {
            var user = userAccountService.register(body.email(), body.password(), body.name(), tenant.getId());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Response.created(new RegisterResponse(user.getId(), user.getEmail())));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "USER_EXISTS", ex.getMessage()));
        }
    }

    /**
     * Accepts an invitation and creates or activates the associated user account.
     *
     * @param body the invitation token and account details
     * @return a response containing the accepted user's identifier and email, or an error for an invalid invitation token
     */
    @PostMapping("/accept-invite")
    ResponseEntity<Response<AcceptInviteResponse>> acceptInvite(@Valid @RequestBody AcceptInviteRequest body) {
        try {
            var user = invitationAcceptanceService.accept(body.token(), body.password(), body.name());
            return ResponseEntity.ok(Response.ok(new AcceptInviteResponse(user.getId(), user.getEmail())));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Response.error(400, "INVALID_INVITATION_TOKEN", ex.getMessage()));
        }
    }

    /**
     * Initiates a password reset request for the specified email address.
     *
     * @param body the password reset request containing the email address
     * @return a response containing the reset token when developer token exposure is enabled
     */
    @PostMapping("/forgot-password")
    ResponseEntity<Response<ForgotPasswordResponse>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest body
    ) {
        String resetToken = passwordResetService.requestReset(body.email());
        String devResetToken = directwerkConfig.isExposeDevTokens() ? resetToken : null;
        return ResponseEntity.accepted().body(Response.accepted(new ForgotPasswordResponse(devResetToken)));
    }

    /**
     * Resets a user's password using a valid reset token.
     *
     * @param body the reset token and new password
     * @return an empty successful response, or an error response when the reset token is invalid
     */
    @PostMapping("/reset-password")
    ResponseEntity<Response<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest body) {
        try {
            passwordResetService.resetPassword(body.token(), body.newPassword());
            return ResponseEntity.ok(Response.emptyOk());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Response.error(400, "INVALID_RESET_TOKEN", ex.getMessage()));
        }
    }

    /**
     * Verifies a registered user's email address using a verification token from email.
     */
    @PostMapping("/verify-email")
    ResponseEntity<Response<VerifyEmailResponse>> verifyEmail(@Valid @RequestBody VerifyEmailRequest body) {
        try {
            var user = emailVerificationService.verify(body.token());
            return ResponseEntity.ok(Response.ok(new VerifyEmailResponse(user.getId(), user.getEmail())));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Response.error(400, "INVALID_VERIFICATION_TOKEN", ex.getMessage()));
        }
    }

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            @Size(max = 255) String name
    ) {
    }

    public record RegisterResponse(Long userId, String email) {
    }

    public record AcceptInviteRequest(
            @NotBlank @Size(max = 512) String token,
            @Size(min = 8, max = 128) String password,
            @Size(max = 255) String name
    ) {
    }

    public record AcceptInviteResponse(Long userId, String email) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email String email) {
    }

    public record ForgotPasswordResponse(String devResetToken) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 512) String token,
            @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {
    }

    public record VerifyEmailRequest(@NotBlank @Size(max = 512) String token) {
    }

    public record VerifyEmailResponse(Long userId, String email) {
    }
}
