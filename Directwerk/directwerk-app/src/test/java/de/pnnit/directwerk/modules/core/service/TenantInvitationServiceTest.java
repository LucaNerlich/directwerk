package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantInvitationServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private InvitationTokenService invitationTokenService;

    @Mock
    private TransactionalEmailNotifier transactionalEmailNotifier;

    @Mock
    private UserProvisioningService userProvisioningService;

    @InjectMocks
    private TenantInvitationService tenantInvitationService;

    @Test
    void inviteCreatesPendingMembershipAndReturnsInviteToken() {
        Tenant tenant = tenant(1L);
        User user = new User();
        user.setId(10L);
        user.setEmail("editor@example.com");
        user.setName("Editor");
        user.setStatus(UserStatus.PENDING_VERIFICATION);

        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(userProvisioningService.findOrCreatePendingUser("editor@example.com", "Editor")).thenReturn(user);
        when(tenantMembershipRepository.findByUserIdAndTenantId(10L, 1L)).thenReturn(Optional.empty());
        when(tenantMembershipRepository.save(any(TenantMembership.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationTokenService.issue(any(User.class), any(TenantMembership.class), any()))
                .thenReturn("raw-invite-token");

        TenantInvitationService.InvitationResult result = tenantInvitationService.invite(
                1L,
                "editor@example.com",
                "Editor",
                "EDITOR"
        );

        ArgumentCaptor<TenantMembership> membershipCaptor = ArgumentCaptor.forClass(TenantMembership.class);
        verify(tenantMembershipRepository).save(membershipCaptor.capture());
        assertThat(membershipCaptor.getValue().getStatus()).isEqualTo(MembershipStatus.INVITED);
        assertThat(membershipCaptor.getValue().getRoles()).containsExactly(Role.EDITOR);
        assertThat(result.status()).isEqualTo("INVITED");
        assertThat(result.inviteToken()).isEqualTo("raw-invite-token");
        verify(invitationTokenService).issue(eq(user), any(TenantMembership.class), eq(InvitationType.TENANT_MEMBER));
        verify(transactionalEmailNotifier).sendTenantInvitation(
                eq(1L),
                eq("editor@example.com"),
                eq("Editor"),
                eq("Tenant 1"),
                eq("EDITOR"),
                eq("raw-invite-token"),
                eq(InvitationTokenService.tokenLifetime())
        );
    }

    @Test
    void inviteActiveUserIssuesJoinOnlyToken() {
        Tenant tenant = tenant(1L);
        User user = new User();
        user.setId(10L);
        user.setEmail("active@example.com");
        user.setName("Active");
        user.setStatus(UserStatus.ACTIVE);

        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(userProvisioningService.findOrCreatePendingUser("active@example.com", "Active")).thenReturn(user);
        when(tenantMembershipRepository.findByUserIdAndTenantId(10L, 1L)).thenReturn(Optional.empty());
        when(tenantMembershipRepository.save(any(TenantMembership.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationTokenService.issue(any(User.class), any(TenantMembership.class), eq(InvitationType.TENANT_JOIN)))
                .thenReturn("join-token");

        TenantInvitationService.InvitationResult result = tenantInvitationService.invite(
                1L,
                "active@example.com",
                "Active",
                "EDITOR"
        );

        assertThat(result.inviteToken()).isEqualTo("join-token");
        verify(invitationTokenService).issue(eq(user), any(TenantMembership.class), eq(InvitationType.TENANT_JOIN));
    }

    private static Tenant tenant(Long id) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug("tenant-" + id);
        tenant.setName("Tenant " + id);
        return tenant;
    }
}
