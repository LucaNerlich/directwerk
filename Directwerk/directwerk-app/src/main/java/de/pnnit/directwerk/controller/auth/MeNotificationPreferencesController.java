package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.NotificationPreferenceService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/notification-preferences")
public class MeNotificationPreferencesController {

    private final NotificationPreferenceService notificationPreferenceService;

    public MeNotificationPreferencesController(NotificationPreferenceService notificationPreferenceService) {
        this.notificationPreferenceService = notificationPreferenceService;
    }

    @GetMapping
    ResponseEntity<Response<NotificationPreferencesView>> getPreferences(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        boolean enabled = notificationPreferenceService.isEmailNotificationsEnabled(user.tenantId(), user.userId());
        return ResponseEntity.ok(Response.ok(new NotificationPreferencesView(enabled)));
    }

    @PatchMapping
    ResponseEntity<Response<NotificationPreferencesView>> updatePreferences(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody UpdateNotificationPreferencesRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        notificationPreferenceService.updateEmailNotificationsEnabled(
                user.tenantId(),
                user.userId(),
                request.emailNotificationsEnabled()
        );
        return ResponseEntity.ok(Response.ok(new NotificationPreferencesView(request.emailNotificationsEnabled())));
    }

    public record NotificationPreferencesView(boolean emailNotificationsEnabled) {
    }

    public record UpdateNotificationPreferencesRequest(@NotNull Boolean emailNotificationsEnabled) {
    }
}
