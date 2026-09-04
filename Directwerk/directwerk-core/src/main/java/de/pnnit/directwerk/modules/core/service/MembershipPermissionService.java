package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.AuthorizationService;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.EffectiveAccess;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists per-editor permission overrides managed by tenant admins (issue #148).
 * Overrides are deny-only and never apply to tenant admins; restricting one is
 * rejected so dashboards cannot create misleading rows.
 */
@Service
@RequiredArgsConstructor
public class MembershipPermissionService {

    private final MembershipPermissionOverrideRepository overrideRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantRepository tenantRepository;
    private final PlatformAuditService platformAuditService;

    @Transactional(readOnly = true)
    public List<MembershipPermissionOverride> listForUser(Long tenantId, Long userId) {
        tenantRepository.requireById(tenantId);
        return overrideRepository.findByTenantIdAndUserId(tenantId, userId);
    }

    /**
     * Enforces a content operation for the acting principal, loading their
     * restriction rows for the principal's tenant.
     *
     * @param principal acting user; {@code null} means a trusted system path
     * (scheduler, workers) that was authorized upstream — HTTP controllers must
     * always pass {@code SecurityUtils.requirePrincipal()}
     * @param ownerUserId creator of the target row, or {@code null} for creates
     * and legacy rows
     * @throws de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException
     * when the operation is refused
     */
    @Transactional(readOnly = true)
    public void requireContentAccess(
            DirectwerkUserPrincipal principal,
            ContentEntityType entity,
            ContentOperation operation,
            Long ownerUserId
    ) {
        if (principal == null || AuthorizationService.isUnrestricted(principal)) {
            return;
        }
        Set<MembershipPermissionOverride> overrides = new HashSet<>();
        if (principal.tenantId() != null && principal.userId() != null) {
            overrides = new HashSet<>(
                    overrideRepository.findByTenantIdAndUserId(principal.tenantId(), principal.userId()));
        }
        AuthorizationService.requireContentAccess(principal, entity, operation, ownerUserId, overrides);
    }

    /**
     * Resolves the full effective-rights matrix for dashboards and UI adaptation.
     */
    @Transactional(readOnly = true)
    public Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effectiveRights(
            DirectwerkUserPrincipal principal
    ) {
        Set<MembershipPermissionOverride> overrides = Set.of();
        if (principal != null && principal.tenantId() != null && principal.userId() != null) {
            overrides = new HashSet<>(
                    overrideRepository.findByTenantIdAndUserId(principal.tenantId(), principal.userId()));
        }
        return AuthorizationService.effectiveRights(principal, overrides);
    }

    /**
     * Effective rights of one member for dashboards. Reconstructs the member's
     * principal from their membership roles (authorities only — no credentials).
     */
    @Transactional(readOnly = true)
    public MemberRights effectiveRightsForMember(Long tenantId, Long targetUserId) {
        tenantRepository.requireById(tenantId);
        TenantMembership membership = tenantMembershipRepository
                .findByTenantIdAndUserId(tenantId, targetUserId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, targetUserId));
        List<MembershipPermissionOverride> overrides =
                overrideRepository.findByTenantIdAndUserId(tenantId, targetUserId);
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                targetUserId,
                membership.getUser().getEmail(),
                "",
                tenantId,
                membership.getRoles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .toList());
        return new MemberRights(
                targetUserId,
                membership.getRoles().stream().map(Enum::name).sorted().toList(),
                overrides,
                AuthorizationService.effectiveRights(principal, new HashSet<>(overrides)));
    }

    public record MemberRights(
            Long userId,
            List<String> roles,
            List<MembershipPermissionOverride> restrictions,
            Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effective
    ) {
    }

    /**
     * Atomically replaces all restriction rows of one member. An empty input list
     * lifts every restriction.
     */
    @Transactional
    public List<MembershipPermissionOverride> replaceForUser(
            Long tenantId, Long targetUserId, List<OverrideInput> inputs) {
        tenantRepository.requireById(tenantId);
        TenantMembership membership = tenantMembershipRepository
                .findByTenantIdAndUserId(tenantId, targetUserId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, targetUserId));
        if (!AuthorizationService.supportsRestrictions(membership.getRoles())) {
            throw new IllegalArgumentException(
                    "Permission restrictions only apply to members with the EDITOR role");
        }
        List<OverrideInput> sanitized = inputs == null ? List.of() : inputs;
        Set<OverrideInput> distinct = new LinkedHashSet<>(sanitized);
        for (OverrideInput input : distinct) {
            validateInput(input);
        }
        overrideRepository.deleteByTenantIdAndMembershipId(tenantId, membership.getId());
        List<MembershipPermissionOverride> saved = new ArrayList<>();
        for (OverrideInput input : distinct) {
            MembershipPermissionOverride override = new MembershipPermissionOverride();
            override.setMembership(membership);
            override.setTenant(membership.getTenant());
            override.setEntityType(input.entityType());
            override.setOperation(input.operation());
            override.setScope(input.scope());
            saved.add(overrideRepository.save(override));
        }
        platformAuditService.record(
                PlatformAuditActions.MEMBER_RESTRICTIONS_CHANGED,
                tenantId,
                Map.of(
                        "userId", targetUserId,
                        "restrictions", saved.stream()
                                .map(row -> row.getEntityType() + "/" + row.getOperation() + "/" + row.getScope())
                                .sorted()
                                .toList()));
        return saved;
    }

    /**
     * Removes every restriction row of one membership. Used when roles change so
     * stale rows can never silently reactivate on a later demotion.
     */
    @Transactional
    public void clearForMembership(Long tenantId, Long membershipId) {
        overrideRepository.deleteByTenantIdAndMembershipId(tenantId, membershipId);
    }

    private static void validateInput(OverrideInput input) {
        if (input == null
                || input.entityType() == null
                || input.operation() == null
                || input.scope() == null) {
            throw new IllegalArgumentException("Restriction requires entityType, operation and scope");
        }
        if (!input.operation().restrictable()) {
            throw new IllegalArgumentException(
                    "Operation " + input.operation() + " cannot be restricted");
        }
        if (input.scope() == RestrictionScope.OTHERS_ONLY
                && !input.operation().supportsOwnOnlyScope()) {
            throw new IllegalArgumentException(
                    "Operation " + input.operation() + " does not support own-content-only restrictions");
        }
    }

    public record OverrideInput(
            ContentEntityType entityType,
            ContentOperation operation,
            RestrictionScope scope
    ) {
    }
}
