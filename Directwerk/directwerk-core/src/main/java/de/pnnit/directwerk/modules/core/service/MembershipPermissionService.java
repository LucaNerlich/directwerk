package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.AuthorizationService;
import de.pnnit.directwerk.modules.core.authorization.ContentAccessGate;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.EffectiveAccess;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
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
        tenantMembershipRepository.findByTenantIdAndUserId(tenantId, userId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, userId));
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
     * Job-context-safe DENY check for background paths (e.g. the Quartz-driven
     * scheduled-publish executors) that have no live {@link DirectwerkUserPrincipal} to
     * pass through {@link #requireContentAccess}, which otherwise no-ops on a null
     * principal. Looks up the content creator's own override rows directly.
     */
    @Transactional(readOnly = true)
    public boolean isDeniedForOwner(Long tenantId, Long ownerUserId, ContentEntityType entity, ContentOperation operation) {
        if (tenantId == null || ownerUserId == null) {
            return false;
        }
        return overrideRepository.findByTenantIdAndUserId(tenantId, ownerUserId).stream()
                .anyMatch(override -> override.getEntityType() == entity
                        && override.getOperation() == operation
                        && override.getScope() == RestrictionScope.DENY);
    }

    /**
     * Returns a checker bound to one entity type. Services store it once
     * instead of repeating the ambient-principal plumbing per operation.
     *
     * <p><b>Fails closed (issue #303).</b> The gate requires an authenticated principal. It
     * previously resolved {@link SecurityUtils#currentPrincipal()}, which is {@code null} outside a
     * security context — and {@link #requireContentAccess} treats a null principal as a trusted
     * system path — so the gate silently allowed whenever the servlet layer had not populated the
     * context, turning any regression there into an authorization bypass.
     *
     * <p>Trusted background paths do not go through the gates: the Quartz scheduled-publish
     * executors use {@link #isDeniedForOwner}, and deliberate system writes use the explicit
     * {@link #requireContentAccess(DirectwerkUserPrincipal, ContentEntityType, ContentOperation,
     * Long)} overload.
     */
    public ContentAccessGate gateFor(ContentEntityType entity) {
        return (operation, ownerUserId) -> {
            DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
            if (principal == null) {
                throw new ContentAccessDeniedException(
                        ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY,
                        entity.name(),
                        operation.name(),
                        "Authentication is required for " + entity + " / " + operation);
            }
            requireContentAccess(principal, entity, operation, ownerUserId);
        };
    }

    /** Convenience gates per content entity; all delegate to {@link #gateFor}. */
    public void requireEpisodeAccess(ContentOperation operation, Long ownerUserId) {
        gateFor(ContentEntityType.EPISODE).require(operation, ownerUserId);
    }

    /** Convenience gates per content entity; all delegate to {@link #gateFor}. */
    public void requireArticleAccess(ContentOperation operation, Long ownerUserId) {
        gateFor(ContentEntityType.ARTICLE).require(operation, ownerUserId);
    }

    /** Convenience gates per content entity; all delegate to {@link #gateFor}. */
    public void requireSeriesAccess(ContentOperation operation, Long ownerUserId) {
        gateFor(ContentEntityType.SERIES).require(operation, ownerUserId);
    }

    /** Convenience gates per content entity; all delegate to {@link #gateFor}. */
    public void requireMediaAssetAccess(ContentOperation operation, Long ownerUserId) {
        gateFor(ContentEntityType.MEDIA_ASSET).require(operation, ownerUserId);
    }

    /** Convenience gates per content entity; all delegate to {@link #gateFor}. */
    public void requireMediaFolderAccess(ContentOperation operation, Long ownerUserId) {
        gateFor(ContentEntityType.MEDIA_FOLDER).require(operation, ownerUserId);
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
        DirectwerkUserPrincipal principal = principalFor(membership, tenantId);
        return new MemberRights(
                targetUserId,
                membership.getRoles().stream().map(Enum::name).sorted().toList(),
                overrides,
                AuthorizationService.effectiveRights(principal, new HashSet<>(overrides)));
    }

    /**
     * Reconstructs the security principal of a tenant member from their membership roles (issue
     * #303). Non-HTTP callers that run user-attributed work — the bulk RSS import jobs, which
     * execute in a queue worker thread on behalf of the editor who requested the import — bind this
     * identity so the fail-closed RBAC gate evaluates the requester's rights instead of denying an
     * unauthenticated run.
     *
     * @return the member's principal, or empty when the user is not a member of the tenant
     */
    @Transactional(readOnly = true)
    public Optional<DirectwerkUserPrincipal> principalForMember(Long tenantId, Long userId) {
        if (tenantId == null || userId == null) {
            return Optional.empty();
        }
        return tenantMembershipRepository
                .findByTenantIdAndUserId(tenantId, userId)
                .map(membership -> principalFor(membership, tenantId));
    }

    private static DirectwerkUserPrincipal principalFor(TenantMembership membership, Long tenantId) {
        return new DirectwerkUserPrincipal(
                membership.getUser().getId(),
                membership.getUser().getEmail(),
                "",
                tenantId,
                membership.getRoles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .toList());
    }

    /**
     * Effective rights for several members in a fixed number of queries (#345).
     *
     * <p>{@link #effectiveRightsForMember} costs three queries per member, so the platform tenant
     * page — which needs one row per editor — issued 3N of them. This batches the tenant existence
     * check, the memberships and the overrides, then reuses the same computation per member.
     *
     * @return rights for the requested users that are actually members of the tenant; ids without a
     *         membership are omitted (the single-member variant throws instead)
     */
    @Transactional(readOnly = true)
    public List<MemberRights> effectiveRightsForMembers(Long tenantId, Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        tenantRepository.requireById(tenantId);
        List<Long> ids = userIds.stream().distinct().toList();

        Map<Long, TenantMembership> memberships = tenantMembershipRepository
                .findByTenantIdAndUserIdIn(tenantId, ids)
                .stream()
                .collect(Collectors.toMap(
                        membership -> membership.getUser().getId(),
                        membership -> membership,
                        (first, second) -> first));
        Map<Long, List<MembershipPermissionOverride>> overridesByUser = overrideRepository
                .findByTenantIdAndUserIdIn(tenantId, ids)
                .stream()
                .collect(Collectors.groupingBy(
                        override -> override.getMembership().getUser().getId()));

        List<MemberRights> rights = new ArrayList<>();
        for (Long userId : ids) {
            TenantMembership membership = memberships.get(userId);
            if (membership == null) {
                continue;
            }
            List<MembershipPermissionOverride> overrides =
                    overridesByUser.getOrDefault(userId, List.of());
            DirectwerkUserPrincipal principal = principalFor(membership, tenantId);
            rights.add(new MemberRights(
                    userId,
                    membership.getRoles().stream().map(Enum::name).sorted().toList(),
                    overrides,
                    AuthorizationService.effectiveRights(principal, new HashSet<>(overrides))));
        }
        return rights;
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
        // The unique index covers (entity, operation) without scope: collapse
        // mixed scopes per pair with DENY winning, mirroring evaluation order.
        Map<List<Enum<?>>, OverrideInput> collapsed = new LinkedHashMap<>();
        for (OverrideInput input : sanitized) {
            validateInput(input);
            List<Enum<?>> key = List.of(input.entityType(), input.operation());
            OverrideInput previous = collapsed.get(key);
            if (previous == null || input.scope() == RestrictionScope.DENY) {
                collapsed.put(key, input);
            }
        }
        overrideRepository.deleteByTenantIdAndMembershipId(tenantId, membership.getId());
        List<MembershipPermissionOverride> saved = new ArrayList<>();
        for (OverrideInput input : collapsed.values()) {
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
