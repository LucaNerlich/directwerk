package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService.AdminPage;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService.PlatformAdminView;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @InjectMocks
    private PlatformAdminManagementService service;

    @AfterEach
    void cleanupSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void stubLastLoginLookup() {
        when(tenantMembershipRepository.findMaxLastLoginAtByUserId(anyLong())).thenReturn(Optional.empty());
    }

    @Test
    void inviteAdminCreatesPendingUserAndReturnsToken() {
        stubLastLoginLookup();
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
        stubLastLoginLookup();
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
        stubLastLoginLookup();
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
        stubLastLoginLookup();
        User user = new User();
        user.setId(20L);
        user.setEmail("second-admin@example.com");
        user.setName("Second Admin");
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);

        when(platformAdminRepository.findAllForUpdate()).thenReturn(List.of(admin, platformAdmin(30L, "third@example.com")));

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

        when(platformAdminRepository.findAllForUpdate()).thenReturn(List.of(admin));

        assertThatThrownBy(() -> service.revokeAdmin(10L))
                .isInstanceOf(CannotRevokeLastPlatformAdminException.class);

        verify(platformAdminRepository, never()).delete(any());
    }

    @Test
    void revokeAdminRejectsUnknownUser() {
        when(platformAdminRepository.findAllForUpdate()).thenReturn(List.of(platformAdmin(10L, "admin@example.com")));

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

        when(platformAdminRepository.findAllForUpdate()).thenReturn(List.of(admin, platformAdmin(20L, "other@example.com")));

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

    @Test
    void listAdminsPagesWithOneBatchedLastLoginLookup() {
        Instant lastLogin = Instant.parse("2026-01-02T03:04:05Z");
        when(platformAdminRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(
                List.of(platformAdmin(10L, "first@example.com"), platformAdmin(20L, "second@example.com")),
                PageRequest.of(1, 2),
                7));
        TenantMembershipRepository.LastLogin lookup = mock(TenantMembershipRepository.LastLogin.class);
        when(lookup.getUserId()).thenReturn(10L);
        when(lookup.getLastLoginAt()).thenReturn(lastLogin);
        when(tenantMembershipRepository.findMaxLastLoginAtByUserIds(anyList()))
                .thenReturn(List.of(lookup));

        AdminPage result = service.listAdmins(1, 2);

        assertThat(result.totalElements()).isEqualTo(7);
        assertThat(result.page()).isEqualTo(1);
        assertThat(result.size()).isEqualTo(2);
        assertThat(result.content()).extracting(PlatformAdminView::email)
                .containsExactly("first@example.com", "second@example.com");
        assertThat(result.content().getFirst().lastLoginAt()).isEqualTo(lastLogin);
        assertThat(result.content().get(1).lastLoginAt()).isNull();

        // #438: one batched lookup for the page, not one per admin.
        verify(tenantMembershipRepository, never()).findMaxLastLoginAtByUserId(anyLong());
        verify(tenantMembershipRepository).findMaxLastLoginAtByUserIds(anyList());

        // A stable sort by id keeps pages from shuffling between requests.
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(platformAdminRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(2);
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by("id").ascending());
    }

    @Test
    void listAdminsClampsThePageSizeToTheControllerMaximum() {
        when(platformAdminRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.listAdmins(-3, 10_000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(platformAdminRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
    }

    private static PlatformAdmin platformAdmin(Long userId, String email) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        return admin;
    }
}
