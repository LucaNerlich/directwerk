package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class StudioWorkspaceDiscoveryServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private TenantMembershipRepository tenantMembershipRepository;
    @Mock
    private TenantDomainRepository tenantDomainRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private StudioWorkspaceDiscoveryService service;

    @Test
    void discoverWorkspacesReturnsEditorMembershipsWithVerifiedHost() {
        User user = activeUser();
        Tenant tenant = activeTenant("alpha-show-a", "Alpha Show A");
        TenantMembership membership = editorMembership(user, tenant);

        when(userRepository.findByEmailIgnoreCase("editor@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("ValidPassword12!", "hash")).thenReturn(true);
        when(tenantMembershipRepository.findActiveMembershipsByUserId(1L, MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(tenantDomainRepository.findVerifiedByTenantIdOrderByPrimaryDescIdAsc(10L))
                .thenReturn(List.of(verifiedDomain(tenant, "alpha-a.localhost")));

        var workspaces = service.discoverWorkspaces("editor@example.com", "ValidPassword12!");

        assertThat(workspaces).hasSize(1);
        assertThat(workspaces.getFirst().host()).isEqualTo("alpha-a.localhost");
        assertThat(workspaces.getFirst().slug()).isEqualTo("alpha-show-a");
    }

    @Test
    void discoverWorkspacesRejectsInvalidCredentials() {
        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.discoverWorkspaces("missing@example.com", "ValidPassword12!"))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void discoverWorkspacesRejectsAccountsWithoutStudioRoles() {
        User user = activeUser();
        Tenant tenant = activeTenant("alpha-show-a", "Alpha Show A");
        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setTenant(tenant);
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setRoles(EnumSet.of(Role.SUBSCRIBER));

        when(userRepository.findByEmailIgnoreCase("subscriber@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("ValidPassword12!", "hash")).thenReturn(true);
        when(tenantMembershipRepository.findActiveMembershipsByUserId(1L, MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership));

        assertThatThrownBy(() -> service.discoverWorkspaces("subscriber@example.com", "ValidPassword12!"))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void discoverWorkspacesUsesDummyHashForUnknownUserTiming() {
        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("dummy");
        when(passwordEncoder.matches("ValidPassword12!", "dummy")).thenReturn(false);

        assertThatThrownBy(() -> service.discoverWorkspaces("missing@example.com", "ValidPassword12!"))
                .isInstanceOf(BadCredentialsException.class);
    }

    private static User activeUser() {
        User user = new User();
        user.setId(1L);
        user.setEmail("editor@example.com");
        user.setPasswordHash("hash");
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private static Tenant activeTenant(String slug, String name) {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug(slug);
        tenant.setName(name);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenant;
    }

    private static TenantMembership editorMembership(User user, Tenant tenant) {
        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setTenant(tenant);
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setRoles(EnumSet.of(Role.EDITOR));
        return membership;
    }

    private static TenantDomain verifiedDomain(Tenant tenant, String host) {
        TenantDomain domain = new TenantDomain();
        domain.setTenant(tenant);
        domain.setHost(host);
        domain.setVerified(true);
        domain.setPrimary(true);
        return domain;
    }
}
