package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.content.TenantMembershipActivatedEvent;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.persistence.EntityManager;
import java.util.EnumSet;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Write-side lifecycle operations for a user's {@link TenantMembership} within a tenant -
 * deactivating (disabling) and reactivating - shared by both the tenant-admin
 * ({@code TenantAdminController}) and platform-admin ({@code PlatformTenantUserController})
 * endpoints so the state-transition and guard logic lives in exactly one place.
 *
 * <p>Mirrors {@link TenantManagementService#suspendTenant} / {@code #reactivateTenant}: the
 * transition itself is idempotent (re-applying the same status is not an error), and every
 * transition is recorded via {@link PlatformAuditService}.
 */
@Service
@RequiredArgsConstructor
public class TenantMembershipManagementService {

    private static final int MEMBERSHIP_LOCK_NAMESPACE = 0x4D454D42; // "MEMB"

    private final TenantMembershipRepository tenantMembershipRepository;
    private final PlatformAuditService platformAuditService;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Deactivates (disables) a user's membership in a tenant.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the member to deactivate
     * @return the updated membership view
     * @throws TenantMembershipNotFoundException if no membership exists for the (tenant, user) pair
     * @throws CannotDeactivateSelfException      if the calling user is the target user
     * @throws CannotDeactivateLastAdminException if the target is the tenant's last active admin
     */
    @Transactional
    public TenantUserQueryService.TenantUserView deactivateMembership(Long tenantId, Long userId) {
        acquireTenantMembershipLock(tenantId);
        TenantMembership membership = requireMembership(tenantId, userId);

        Long callerUserId = SecurityUtils.currentUserId();
        if (callerUserId != null && callerUserId.equals(userId)) {
            throw new CannotDeactivateSelfException(userId);
        }
        if (wouldRemoveLastActiveAdmin(membership, tenantId, userId)) {
            throw new CannotDeactivateLastAdminException(userId);
        }

        membership.setStatus(MembershipStatus.DISABLED);
        TenantMembership saved = tenantMembershipRepository.save(membership);
        platformAuditService.record(
                PlatformAuditActions.MEMBERSHIP_DEACTIVATED,
                tenantId,
                Map.of("userId", userId)
        );
        return toView(saved);
    }

    /**
     * Reactivates a previously deactivated membership in a tenant.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the member to reactivate
     * @return the updated membership view
     * @throws TenantMembershipNotFoundException if no membership exists for the (tenant, user) pair
     */
    @Transactional
    public TenantUserQueryService.TenantUserView reactivateMembership(Long tenantId, Long userId) {
        TenantMembership membership = requireMembership(tenantId, userId);
        membership.setStatus(MembershipStatus.ACTIVE);
        TenantMembership saved = tenantMembershipRepository.save(membership);
        eventPublisher.publishEvent(new TenantMembershipActivatedEvent(tenantId, userId));
        platformAuditService.record(
                PlatformAuditActions.MEMBERSHIP_REACTIVATED,
                tenantId,
                Map.of("userId", userId)
        );
        return toView(saved);
    }

    /**
     * Replaces a tenant user's roles with a single new role.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the member whose role changes
     * @param role     the new role name (must be a tenant-scoped {@link Role}, not {@code PLATFORM_ADMIN})
     * @return the updated membership view
     * @throws TenantMembershipNotFoundException if no membership exists for the (tenant, user) pair
     * @throws IllegalArgumentException if {@code role} is not a valid tenant-scoped role name
     * @throws CannotDeactivateLastAdminException if this change would leave the tenant with zero
     *                                             active {@code TENANT_ADMIN} memberships
     */
    @Transactional
    public TenantUserQueryService.TenantUserView updateRole(Long tenantId, Long userId, String role) {
        acquireTenantMembershipLock(tenantId);
        Role newRole;
        try {
            newRole = Role.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new IllegalArgumentException("Unknown role: " + role, ex);
        }
        if (newRole == Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("PLATFORM_ADMIN is not a tenant-scoped role");
        }

        TenantMembership membership = requireMembership(tenantId, userId);
        boolean wasActiveAdmin = membership.getStatus() == MembershipStatus.ACTIVE
                && membership.getRoles().contains(Role.TENANT_ADMIN);
        if (wasActiveAdmin && newRole != Role.TENANT_ADMIN
                && wouldRemoveLastActiveAdmin(membership, tenantId, userId)) {
            throw new CannotDeactivateLastAdminException(userId);
        }

        membership.setRoles(EnumSet.of(newRole));
        TenantMembership saved = tenantMembershipRepository.save(membership);
        platformAuditService.record(
                PlatformAuditActions.MEMBERSHIP_ROLE_CHANGED,
                tenantId,
                Map.of("userId", userId, "role", newRole.name())
        );
        return toView(saved);
    }

    /**
     * Retrieves a tenant membership for the specified user.
     *
     * @param tenantId the tenant identifier
     * @param userId   the user identifier
     * @return the user's membership in the tenant
     * @throws TenantMembershipNotFoundException if the membership does not exist
     */
    private TenantMembership requireMembership(Long tenantId, Long userId) {
        return tenantMembershipRepository.findByUserIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, userId));
    }

    // Serializes membership mutations per tenant so two racing deactivations/demotions cannot
    // both evaluate wouldRemoveLastActiveAdmin against the same "one admin remaining" snapshot
    // and jointly leave the tenant with zero active admins. The lock is held until the
    // surrounding transaction commits, so the second request re-reads committed state.
    private void acquireTenantMembershipLock(Long tenantId) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?, ?)")
                .setParameter(1, MEMBERSHIP_LOCK_NAMESPACE)
                .setParameter(2, tenantId.intValue())
                .getSingleResult();
    }

    /**
     * Determines whether deactivating {@code target} would leave the tenant with zero active
     * {@code TENANT_ADMIN} memberships. Only meaningful when the target is currently an active
     * admin themselves - deactivating a non-admin, or re-disabling an already-disabled admin,
     * never removes an active admin and so never trips this guard.
     */
    private boolean wouldRemoveLastActiveAdmin(TenantMembership target, Long tenantId, Long userId) {
        if (target.getStatus() != MembershipStatus.ACTIVE || !target.getRoles().contains(Role.TENANT_ADMIN)) {
            return false;
        }
        long remainingActiveAdmins = tenantMembershipRepository.findByTenantId(tenantId).stream()
                .filter(membership -> !membership.getUser().getId().equals(userId))
                .filter(membership -> membership.getStatus() == MembershipStatus.ACTIVE)
                .filter(membership -> membership.getRoles().contains(Role.TENANT_ADMIN))
                .count();
        return remainingActiveAdmins == 0;
    }

    private TenantUserQueryService.TenantUserView toView(TenantMembership membership) {
        return new TenantUserQueryService.TenantUserView(
                membership.getUser().getId(),
                membership.getUser().getEmail(),
                membership.getUser().getName(),
                membership.getRoles().stream().map(Enum::name).sorted().toList(),
                membership.getStatus().name(),
                membership.getInvitedAt(),
                membership.getLastLoginAt()
        );
    }
}
