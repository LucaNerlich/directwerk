package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import java.util.EnumSet;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserAccountServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @InjectMocks
    private UserAccountService userAccountService;

    @Test
    void registerRejectsSuspendedTenantWithoutWrites() {
        Tenant suspendedTenant = tenant(3L);
        suspendedTenant.setStatus(TenantStatus.SUSPENDED);

        when(tenantRepository.findById(3L)).thenReturn(Optional.of(suspendedTenant));

        assertThatThrownBy(() -> userAccountService.register(
                "member@example.com",
                "valid-password",
                "Member",
                suspendedTenant.getId()
        )).isInstanceOf(TenantSuspendedException.class);

        verify(userRepository, never()).save(any());
        verify(tenantMembershipRepository, never()).save(any());
    }

    @Test
    void registerExistingUserOnNewTenantRequiresPasswordProof() {
        Tenant tenantB = tenant(2L);
        User existingUser = user(10L, "member@example.com", "hash");

        when(tenantRepository.findById(2L)).thenReturn(Optional.of(tenantB));
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(existingUser));
        when(tenantMembershipRepository.findByUserIdAndTenantId(10L, 2L)).thenReturn(Optional.empty());
        when(passwordEncoder.matches("wrong-password", "hash")).thenReturn(false);

        assertThatThrownBy(() -> userAccountService.register(
                "member@example.com",
                "wrong-password",
                "Member",
                tenantB.getId()
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Account ownership verification failed");

        verify(tenantMembershipRepository, never()).save(any());
    }

    @Test
    void registerExistingUserOnNewTenantWithValidPasswordCreatesMembership() {
        Tenant tenantB = tenant(2L);
        User existingUser = user(10L, "member@example.com", "hash");

        when(tenantRepository.findById(2L)).thenReturn(Optional.of(tenantB));
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(existingUser));
        when(tenantMembershipRepository.findByUserIdAndTenantId(10L, 2L)).thenReturn(Optional.empty());
        when(passwordEncoder.matches("correct-password", "hash")).thenReturn(true);
        when(directwerkConfig.isEmailVerificationRequired()).thenReturn(false);

        User registered = userAccountService.register(
                "member@example.com",
                "correct-password",
                "Member",
                tenantB.getId()
        );

        assertThat(registered).isSameAs(existingUser);
        verify(tenantMembershipRepository).save(any());
    }

    @Test
    void registerActivatesExistingInvitedMembership() {
        Tenant tenant = tenant(1L);
        User invitedUser = user(10L, "editor@example.com", null);
        TenantMembership invitedMembership = membership(100L, invitedUser, tenant, MembershipStatus.INVITED, Role.EDITOR);

        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(userRepository.findByEmailIgnoreCase("editor@example.com")).thenReturn(Optional.of(invitedUser));
        when(tenantMembershipRepository.findByUserIdAndTenantId(10L, 1L)).thenReturn(Optional.of(invitedMembership));
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-password");
        when(directwerkConfig.isEmailVerificationRequired()).thenReturn(false);
        when(userRepository.save(invitedUser)).thenReturn(invitedUser);
        when(tenantMembershipRepository.save(invitedMembership)).thenReturn(invitedMembership);

        User registered = userAccountService.register(
                "editor@example.com",
                "new-password",
                "Editor",
                tenant.getId()
        );

        assertThat(registered).isSameAs(invitedUser);
        assertThat(invitedMembership.getStatus()).isEqualTo(MembershipStatus.ACTIVE);
        verify(tenantMembershipRepository).save(invitedMembership);
    }

    private static TenantMembership membership(
            Long id,
            User user,
            Tenant tenant,
            MembershipStatus status,
            Role role
    ) {
        TenantMembership membership = new TenantMembership();
        membership.setId(id);
        membership.setUser(user);
        membership.setTenant(tenant);
        membership.setStatus(status);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }

    private static Tenant tenant(Long id) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug("tenant-" + id);
        tenant.setName("Tenant " + id);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenant;
    }

    private static User user(Long id, String email, String passwordHash) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        return user;
    }
}
