package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the caller's <em>current</em> tenant membership from the Spring Security context
 * and validates it against the Host-derived {@link TenantContext}.
 *
 * <p>Client-supplied tenant identifiers (headers, body, query) are never trusted. The
 * authenticated {@link DirectwerkUserPrincipal#tenantId()} is authoritative for which
 * tenant membership the token was issued for; {@link TenantContext} must match it.
 */
@Service
@RequiredArgsConstructor
public class CurrentTenantMembershipService {

    private final TenantMembershipRepository tenantMembershipRepository;

    /**
     * Requires an authenticated tenant principal whose JWT/security-context tenant matches
     * {@link TenantContext}, and whose DB membership is still {@link MembershipStatus#ACTIVE}.
     *
     * <p>Transactional (read-only) so the repository lookup runs on a
     * transaction-bound session with the tenant Hibernate filter applied.</p>
     *
     * @return the active membership for the current security principal and tenant context
     * @throws TenantMismatchException if principal, context, or membership validation fails
     */
    @Transactional(readOnly = true)
    public TenantMembership requireActiveMembership() {
        DirectwerkUserPrincipal principal = SecurityUtils.requireTenantPrincipal();
        Long contextTenantId = TenantContext.requireTenantId();
        if (!contextTenantId.equals(principal.tenantId())) {
            throw new TenantMismatchException();
        }

        return tenantMembershipRepository
                .findByUserIdAndTenantId(principal.userId(), contextTenantId)
                .filter(membership -> membership.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> new TenantMismatchException(
                        "Tenant membership is no longer active for this host"
                ));
    }
}
