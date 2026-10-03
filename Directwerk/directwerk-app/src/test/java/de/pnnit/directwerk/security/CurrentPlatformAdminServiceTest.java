package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.multitenancy.PlatformAdminAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentPlatformAdminServiceTest {

    private final PlatformAdminRepository platformAdminRepository = mock(PlatformAdminRepository.class);
    private final CurrentPlatformAdminService service = new CurrentPlatformAdminService(platformAdminRepository);

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requireActivePlatformAdminRejectsMissingAdminRow() {
        authenticate(5L);
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(service::requireActivePlatformAdmin)
                .isInstanceOf(PlatformAdminAccessDeniedException.class);
    }

    @Test
    void requireActivePlatformAdminRejectsInactiveUser() {
        authenticate(5L);
        User user = new User();
        user.setStatus(UserStatus.PENDING_VERIFICATION);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(service::requireActivePlatformAdmin)
                .isInstanceOf(PlatformAdminAccessDeniedException.class);
    }

    @Test
    void requireActivePlatformAdminRejectsUnauthenticated() {
        assertThatThrownBy(service::requireActivePlatformAdmin)
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void requireActivePlatformAdminAllowsActiveAdmin() {
        authenticate(5L);
        User user = new User();
        user.setStatus(UserStatus.ACTIVE);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.of(admin));

        service.requireActivePlatformAdmin();
    }

    private static void authenticate(Long userId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId,
                "platform@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }
}
