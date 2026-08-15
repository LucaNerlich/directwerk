package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class PlatformAdminManagementServiceTest {

    @Mock
    private PlatformAdminRepository platformAdminRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private InvitationTokenService invitationTokenService;

    @Mock
    private TransactionalEmailNotifier transactionalEmailNotifier;

    @Mock
    private UserProvisioningService userProvisioningService;

    @Mock
    private PlatformAuditService platformAuditService;

    @InjectMocks
    private PlatformAdminManagementService service;

    @AfterEach
    void cleanupSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void inviteAdminCreatesPendingUserAndReturnsToken() {
        User user = new User();
        user.setId(10L);
        user.setEmail("admin@example.com");
        user.setName("Admin");
        user.setStatus(UserStatus.PENDING_VERIFICATION);

        when(userProvisioningService.findOrCreatePendingUser("admin@example.com", "Admin")).thenReturn(user);
        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.empty());
        when(invitationTokenService.issue(any(User.class), any(), any(InvitationType.class)))
                .thenReturn("platform-invite-token");

        PlatformAdminManagementService.PlatformAdminInvitation result =
                service.inviteAdmin("Admin@Example.com", "Admin");

        assertThat(result.admin().email()).isEqualTo("admin@example.com");
        assertThat(result.admin().name()).isEqualTo("Admin");
        assertThat(result.inviteToken()).isEqualTo("platform-invite-token");
        assertThat(result.status()).isEqualTo("PENDING_VERIFICATION");
        verify(userRepository).save(user);
        verify(transactionalEmailNotifier).sendPlatformAdminInvitation(
                "admin@example.com",
                "Admin",
                "platform-invite-token",
                InvitationTokenService.tokenLifetime()
        );
    }

    @Test
    void inviteAdminRequiresAcceptanceForActiveUser() {
        User user = new User();
        user.setId(10L);
        user.setEmail("existing@example.com");
        user.setName("Existing Admin");
        user.setStatus(UserStatus.ACTIVE);

        when(userProvisioningService.findOrCreatePendingUser("existing@example.com", "Existing Admin"))
                .thenReturn(user);
        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.empty());
        when(invitationTokenService.issue(any(User.class), any(), any(InvitationType.class)))
                .thenReturn("platform-invite-token");

        PlatformAdminManagementService.PlatformAdminInvitation result =
                service.inviteAdmin("existing@example.com", "Existing Admin");

        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(result.status()).isEqualTo("ACTIVE");
        assertThat(result.inviteToken()).isEqualTo("platform-invite-token");
        verify(userRepository, never()).save(user);
        verify(platformAdminRepository, never()).save(any());
        verify(transactionalEmailNotifier).sendPlatformAdminInvitation(
                "existing@example.com",
                "Existing Admin",
                "platform-invite-token",
                InvitationTokenService.tokenLifetime()
        );
    }

    @Test
    void inviteAdminKeepsExistingActivePlatformAdminWithoutReinvite() {
        User user = new User();
        user.setId(10L);
        user.setEmail("existing@example.com");
        user.setStatus(UserStatus.ACTIVE);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);

        when(userProvisioningService.findOrCreatePendingUser("existing@example.com", "Existing Admin"))
                .thenReturn(user);
        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.of(admin));

        PlatformAdminManagementService.PlatformAdminInvitation result =
                service.inviteAdmin("existing@example.com", "Existing Admin");

        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(result.inviteToken()).isNull();
        verify(userRepository, never()).save(user);
        verify(invitationTokenService, never()).issue(any(), any(), any());
        verify(platformAdminRepository, never()).save(any());
    }

    @Test
    void revokeAdminRemovesAdminWhenMultipleAdminsExist() {
        User user = new User();
        user.setId(20L);
        user.setEmail("second-admin@example.com");
        user.setName("Second Admin");
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);

        when(platformAdminRepository.findByUserId(20L)).thenReturn(Optional.of(admin));
        when(platformAdminRepository.count()).thenReturn(2L);

        PlatformAdminManagementService.PlatformAdminView revoked = service.revokeAdmin(20L);

        assertThat(revoked.userId()).isEqualTo(20L);
        assertThat(revoked.email()).isEqualTo("second-admin@example.com");
        verify(platformAdminRepository).delete(admin);
    }

    @Test
    void revokeAdminRejectsWhenOnlyOneAdminExists() {
        User user = new User();
        user.setId(10L);
        user.setEmail("only-admin@example.com");
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);

        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.of(admin));
        when(platformAdminRepository.count()).thenReturn(1L);

        assertThatThrownBy(() -> service.revokeAdmin(10L))
                .isInstanceOf(CannotRevokeLastPlatformAdminException.class);

        verify(platformAdminRepository, never()).delete(any());
    }

    @Test
    void revokeAdminRejectsUnknownUser() {
        when(platformAdminRepository.findByUserId(999_999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revokeAdmin(999_999L))
                .isInstanceOf(PlatformAdminNotFoundException.class);
    }

    @Test
    void revokeAdminRejectsSelfRevocationEvenWhenMultipleAdminsExist() {
        authenticateAs(10L);
        User user = new User();
        user.setId(10L);
        user.setEmail("self@example.com");
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);

        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.revokeAdmin(10L))
                .isInstanceOf(CannotRevokeSelfException.class);

        verify(platformAdminRepository, never()).delete(any());
    }

    private static void authenticateAs(Long userId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId,
                "user-" + userId + "@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }
}
