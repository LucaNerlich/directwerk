package de.pnnit.directwerk.modules.core.authorization;

import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Single home for content RBAC decisions (issue #148).
 *
 * <p>Evaluation order per call:
 * <ol>
 *   <li>{@code PLATFORM_ADMIN} principals are always allowed (platform ops paths).</li>
 *   <li>{@code TENANT_ADMIN} principals are always allowed — overrides never apply to them.</li>
 *   <li>{@code EDITOR} principals are allowed by the content baseline (full CRUD), then
 *       per-editor deny overrides are applied: a {@code DENY} row refuses outright, an
 *       {@code OTHERS_ONLY} row refuses when the content is not theirs.</li>
 *   <li>Anything else (subscribers, guests, unknown) is denied fail-closed.</li>
 * </ol>
 *
 * <p>Ownership is a plain user id ({@code created_by}); legacy rows with a {@code null}
 * creator count as not-owned. Reads are never restricted, so lists stay coherent.
 */
public final class AuthorizationService {

    private AuthorizationService() {
    }

    /**
     * @param principal the acting user; must carry tenant roles
     * @param entity the content entity type
     * @param operation the attempted operation
     * @param ownerUserId creator of the target row, or {@code null} for creates and legacy rows
     * @param overrides the actor's restriction rows for this tenant (ignored for admins)
     * @throws ContentAccessDeniedException when the operation is refused
     */
    public static void requireContentAccess(
            DirectwerkUserPrincipal principal,
            ContentEntityType entity,
            ContentOperation operation,
            Long ownerUserId,
            Set<MembershipPermissionOverride> overrides
    ) {
        if (principal == null) {
            throw new ContentAccessDeniedException(
                    ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY,
                    entity.name(),
                    operation.name(),
                    "Authentication is required");
        }
        if (isUnrestricted(principal)) {
            return;
        }
        if (!hasAuthority(principal, RoleConstants.EDITOR)) {
            throw new ContentAccessDeniedException(
                    ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY,
                    entity.name(),
                    operation.name(),
                    "Role EDITOR or TENANT_ADMIN is required for content operations");
        }
        if (overrides == null || overrides.isEmpty()) {
            return;
        }
        boolean denied = false;
        boolean ownOnly = false;
        for (MembershipPermissionOverride override : overrides) {
            if (override.getEntityType() != entity || override.getOperation() != operation) {
                continue;
            }
            if (override.getScope() == RestrictionScope.DENY) {
                denied = true;
                break;
            }
            ownOnly = true;
        }
        if (denied) {
            throw new ContentAccessDeniedException(
                    ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY,
                    entity.name(),
                    operation.name(),
                    "This operation was restricted for your account by a tenant admin");
        }
        if (ownOnly && !isOwner(principal, ownerUserId)) {
            throw new ContentAccessDeniedException(
                    ContentAccessDeniedException.NOT_CONTENT_OWNER,
                    entity.name(),
                    operation.name(),
                    "This operation is restricted to the content creator");
        }
    }

    /**
     * Resolves the effective rights matrix for dashboards and UI adaptation.
     * Tenant admins (and platform admins) see everything allowed; editors see the
     * baseline minus their overrides. Own-only rights surface as {@code OWN_ONLY}
     * so studios can hint correctly — the backend still decides per row.
     */
    public static Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effectiveRights(
            DirectwerkUserPrincipal principal,
            Set<MembershipPermissionOverride> overrides
    ) {
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effective =
                new EnumMap<>(ContentEntityType.class);
        boolean fullAccess = principal != null
                && (hasAuthority(principal, RoleConstants.PLATFORM_ADMIN)
                        || hasAuthority(principal, RoleConstants.TENANT_ADMIN));
        boolean editor = principal != null && hasAuthority(principal, RoleConstants.EDITOR);
        for (ContentEntityType entity : ContentEntityType.values()) {
            Map<ContentOperation, EffectiveAccess> operations = new EnumMap<>(ContentOperation.class);
            for (ContentOperation operation : ContentOperation.values()) {
                operations.put(operation, resolveEffective(fullAccess, editor, entity, operation, overrides));
            }
            effective.put(entity, operations);
        }
        return effective;
    }

    /**
     * The roles allowed to hold restriction rows. Tenant admins bypass overrides,
     * so restricting them is meaningless and rejected at write time.
     */
    public static boolean supportsRestrictions(Set<Role> roles) {
        return roles != null && roles.contains(Role.EDITOR) && !roles.contains(Role.TENANT_ADMIN);
    }

    /**
     * Whether the principal bypasses all restriction checks (platform and tenant
     * admins). Callers use this to skip loading overrides entirely.
     */
    public static boolean isUnrestricted(DirectwerkUserPrincipal principal) {
        return principal != null
                && (hasAuthority(principal, RoleConstants.PLATFORM_ADMIN)
                        || hasAuthority(principal, RoleConstants.TENANT_ADMIN));
    }

    private static EffectiveAccess resolveEffective(
            boolean fullAccess,
            boolean editor,
            ContentEntityType entity,
            ContentOperation operation,
            Set<MembershipPermissionOverride> overrides
    ) {
        if (fullAccess) {
            return EffectiveAccess.FULL;
        }
        if (!editor) {
            return EffectiveAccess.DENIED;
        }
        if (overrides == null || overrides.isEmpty()) {
            return EffectiveAccess.FULL;
        }
        boolean ownOnly = false;
        for (MembershipPermissionOverride override : overrides) {
            if (override.getEntityType() != entity || override.getOperation() != operation) {
                continue;
            }
            if (override.getScope() == RestrictionScope.DENY) {
                return EffectiveAccess.DENIED;
            }
            ownOnly = true;
        }
        return ownOnly ? EffectiveAccess.OWN_ONLY : EffectiveAccess.FULL;
    }

    private static boolean isOwner(DirectwerkUserPrincipal principal, Long ownerUserId) {
        return ownerUserId != null && ownerUserId.equals(principal.userId());
    }

    private static boolean hasAuthority(DirectwerkUserPrincipal principal, String authority) {
        return principal.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
