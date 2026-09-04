package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class TenantMembershipManagementServiceTest {

    private static final Long TENANT_ID = 1L;
    private static final String LOCK_QUERY = "SELECT pg_advisory_xact_lock(?, ?)";

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionService membershipPermissionService;

    @Mock
    private EntityManager entityManager;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private jakarta.persistence.Query lockQuery;

    @InjectMocks
    private TenantMembershipManagementService service;

    @BeforeEach
    void stubTenantAdvisoryLock() {
        // Not every path reaches the lock; lenient keeps strict-stubs happy.
        lenient().when(entityManager.createNativeQuery(LOCK_QUERY)).thenReturn(lockQuery);
        lenient().when(lockQuery.setParameter(ArgumentMatchers.anyInt(), ArgumentMatchers.any()))
                .thenReturn(lockQuery);
        lenient().when(lockQuery.getSingleResult()).thenReturn(new Object());
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deactivatesNonAdminMembershipWithoutGuards() {
        authenticateAs(99L);
        TenantMembership membership = membership(5L, MembershipStatus.ACTIVE, Role.EDITOR);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantUserQueryService.TenantUserView result = service.deactivateMembership(TENANT_ID, 5L);

        assertThat(result.status()).isEqualTo("DISABLED");
        assertThat(membership.getStatus()).isEqualTo(MembershipStatus.DISABLED);
        verify(platformAuditService).record(
                eq(PlatformAuditActions.MEMBERSHIP_DEACTIVATED),
                eq(TENANT_ID),
                eq(Map.of("userId", 5L))
        );
    }

    @Test
    void reactivatesMembership() {
        TenantMembership membership = membership(5L, MembershipStatus.DISABLED, Role.SUBSCRIBER);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantUserQueryService.TenantUserView result = service.reactivateMembership(TENANT_ID, 5L);

        assertThat(result.status()).isEqualTo("ACTIVE");
        assertThat(membership.getStatus()).isEqualTo(MembershipStatus.ACTIVE);
        verify(platformAuditService).record(
                eq(PlatformAuditActions.MEMBERSHIP_REACTIVATED),
                eq(TENANT_ID),
                eq(Map.of("userId", 5L))
        );
    }

    @Test
    void reactivateAppliesNoGuards() {
        // Reactivating the caller themselves, even as the tenant's only admin, is always allowed -
        // the self/last-admin guards are deactivate-only.
        authenticateAs(5L);
        TenantMembership membership = membership(5L, MembershipStatus.DISABLED, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantUserQueryService.TenantUserView result = service.reactivateMembership(TENANT_ID, 5L);

        assertThat(result.status()).isEqualTo("ACTIVE");
        verify(tenantMembershipRepository, never()).findByTenantId(TENANT_ID);
    }

    @Test
    void rejectsSelfDeactivation() {
        authenticateAs(5L);
        TenantMembership membership = membership(5L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));

        assertThatThrownBy(() -> service.deactivateMembership(TENANT_ID, 5L))
                .isInstanceOf(CannotDeactivateSelfException.class);
    }

    @Test
    void rejectsDeactivatingLastActiveAdmin() {
        authenticateAs(99L);
        TenantMembership target = membership(5L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(target));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(target));

        assertThatThrownBy(() -> service.deactivateMembership(TENANT_ID, 5L))
                .isInstanceOf(CannotDeactivateLastAdminException.class);
    }

    @Test
    void deactivationAcquiresTenantAdvisoryLockBeforeEvaluatingGuard() {
        authenticateAs(99L);
        TenantMembership target = membership(5L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(target));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(target));

        assertThatThrownBy(() -> service.deactivateMembership(TENANT_ID, 5L))
                .isInstanceOf(CannotDeactivateLastAdminException.class);

        org.mockito.InOrder inOrder =
                org.mockito.Mockito.inOrder(entityManager, lockQuery, tenantMembershipRepository);
        inOrder.verify(entityManager).createNativeQuery(LOCK_QUERY);
        inOrder.verify(lockQuery).getSingleResult();
        inOrder.verify(tenantMembershipRepository).findByUserIdAndTenantId(5L, TENANT_ID);
        inOrder.verify(tenantMembershipRepository).findByTenantId(TENANT_ID);
    }

    @Test
    void allowsDeactivatingAdminWhenAnotherActiveAdminRemains() {
        authenticateAs(99L);
        TenantMembership target = membership(5L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        TenantMembership otherAdmin = membership(6L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(target));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(target, otherAdmin));
        when(tenantMembershipRepository.save(target)).thenReturn(target);

        TenantUserQueryService.TenantUserView result = service.deactivateMembership(TENANT_ID, 5L);

        assertThat(result.status()).isEqualTo("DISABLED");
    }

    @Test
    void deactivatingAlreadyDisabledAdminIsIdempotentAndSkipsLastAdminGuard() {
        authenticateAs(99L);
        TenantMembership target = membership(5L, MembershipStatus.DISABLED, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(target));
        when(tenantMembershipRepository.save(target)).thenReturn(target);

        TenantUserQueryService.TenantUserView result = service.deactivateMembership(TENANT_ID, 5L);

        assertThat(result.status()).isEqualTo("DISABLED");
        verify(platformAuditService).record(
                eq(PlatformAuditActions.MEMBERSHIP_DEACTIVATED),
                eq(TENANT_ID),
                eq(Map.of("userId", 5L))
        );
    }

    @Test
    void throwsNotFoundWhenMembershipMissing() {
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deactivateMembership(TENANT_ID, 5L))
                .isInstanceOf(TenantMembershipNotFoundException.class);
    }

    @Test
    void updateRoleReplacesRolesWithSingleNewRole() {
        TenantMembership membership = membership(5L, MembershipStatus.ACTIVE, Role.EDITOR);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantUserQueryService.TenantUserView updated = service.updateRole(TENANT_ID, 5L, "TENANT_ADMIN");

        assertThat(updated.roles()).containsExactly("TENANT_ADMIN");
        assertThat(membership.getRoles()).containsExactly(Role.TENANT_ADMIN);
        verify(platformAuditService).record(
                eq(PlatformAuditActions.MEMBERSHIP_ROLE_CHANGED),
                eq(TENANT_ID),
                eq(Map.of("userId", 5L, "role", "TENANT_ADMIN"))
        );
    }

    @Test
    void updateRoleClearsStalePermissionRestrictions() {
        Long membershipId = 7L;
        TenantMembership membership = membership(5L, MembershipStatus.ACTIVE, Role.EDITOR);
        membership.setId(membershipId);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        service.updateRole(TENANT_ID, 5L, "TENANT_ADMIN");

        verify(membershipPermissionService).clearForMembership(TENANT_ID, membershipId);
    }

    @Test
    void updateRoleRejectsUnknownRoleName() {
        assertThatThrownBy(() -> service.updateRole(TENANT_ID, 5L, "NOT_A_ROLE"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateRoleRejectsPlatformAdminRole() {
        assertThatThrownBy(() -> service.updateRole(TENANT_ID, 5L, "PLATFORM_ADMIN"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateRoleRejectsDemotingLastActiveAdmin() {
        TenantMembership target = membership(5L, MembershipStatus.ACTIVE, Role.TENANT_ADMIN);
        when(tenantMembershipRepository.findByUserIdAndTenantId(5L, TENANT_ID)).thenReturn(Optional.of(target));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(target));

        assertThatThrownBy(() -> service.updateRole(TENANT_ID, 5L, "EDITOR"))
                .isInstanceOf(CannotDeactivateLastAdminException.class);
    }

    private static void authenticateAs(Long userId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId,
                "user-" + userId + "@example.com",
                "hash",
                TENANT_ID,
                List.of(new SimpleGrantedAuthority(RoleConstants.TENANT_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }

    private static TenantMembership membership(Long userId, MembershipStatus status, Role role) {
        User user = new User();
        user.setId(userId);
        user.setEmail("user-" + userId + "@example.com");
        user.setName("User " + userId);

        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setStatus(status);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }
}
