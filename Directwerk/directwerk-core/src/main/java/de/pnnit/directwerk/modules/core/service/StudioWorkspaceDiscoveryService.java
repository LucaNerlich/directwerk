package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves studio-eligible tenant workspaces for shared {@code directwerk-studio} login
 * (single deployment, many tenants).
 */
@Service
@RequiredArgsConstructor
public class StudioWorkspaceDiscoveryService {

    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantDomainRepository tenantDomainRepository;
    private final TenantBrandingRepository tenantBrandingRepository;
    private final PasswordEncoder passwordEncoder;

    private volatile String missingUserEncodedPassword;

    /**
     * Verifies credentials and returns active editor/admin workspaces with a verified routing host.
     *
     * @param email    account email
     * @param password account password
     * @return workspaces sorted by tenant name
     * @throws BadCredentialsException when email/password do not match an active account,
     *         or when the account has no studio-eligible memberships (deliberately
     *         indistinguishable to avoid a credential-validation oracle)
     */
    @Transactional(readOnly = true)
    public List<StudioWorkspaceView> discoverWorkspaces(String email, String password) {
        PasswordPolicy.validate(password);

        Optional<User> user = userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .filter(found -> found.getStatus() == UserStatus.ACTIVE);

        String hashToVerify = user.map(User::getPasswordHash).orElseGet(this::missingUserEncodedPassword);
        boolean passwordMatches = passwordEncoder.matches(password, hashToVerify);

        if (user.isEmpty()) {
            throw invalidCredentials();
        }

        List<TenantMembership> memberships = tenantMembershipRepository.findActiveMembershipsByUserId(
                user.get().getId(),
                MembershipStatus.ACTIVE
        );

        List<EligibleTenant> eligible = new ArrayList<>();
        for (TenantMembership membership : memberships) {
            if (!hasStudioAccess(membership)) {
                continue;
            }
            Tenant tenant = membership.getTenant();
            if (!tenant.isActive()) {
                continue;
            }
            Optional<String> host = resolveRoutingHost(tenant.getId());
            if (host.isEmpty()) {
                continue;
            }
            eligible.add(new EligibleTenant(tenant, host.get()));
        }

        Map<Long, TenantBranding> brandingByTenantId = loadBrandingByTenantId(eligible);

        List<StudioWorkspaceView> workspaces = new ArrayList<>(eligible.size());
        for (EligibleTenant item : eligible) {
            TenantBranding branding = brandingByTenantId.get(item.tenant().getId());
            workspaces.add(new StudioWorkspaceView(
                    item.tenant().getId(),
                    item.tenant().getSlug(),
                    item.tenant().getName(),
                    item.host(),
                    branding != null ? branding.getFaviconUrl() : null,
                    branding != null ? branding.getLogoUrl() : null
            ));
        }

        workspaces.sort(Comparator.comparing(StudioWorkspaceView::name, String.CASE_INSENSITIVE_ORDER));

        if (!passwordMatches || workspaces.isEmpty()) {
            // Same 401 as bad credentials: distinguishing "valid login, no
            // studio access" (403) would let attackers verify guessed passwords.
            // Active users take the same bounded membership/domain discovery
            // path regardless of whether the submitted password is correct.
            throw invalidCredentials();
        }

        return workspaces;
    }

    private Map<Long, TenantBranding> loadBrandingByTenantId(List<EligibleTenant> eligible) {
        if (eligible.isEmpty()) {
            return Map.of();
        }
        List<Long> tenantIds = eligible.stream().map(item -> item.tenant().getId()).toList();
        Map<Long, TenantBranding> brandingByTenantId = new HashMap<>();
        for (TenantBranding branding : tenantBrandingRepository.findByTenantIdIn(tenantIds)) {
            brandingByTenantId.put(branding.getTenantId(), branding);
        }
        return brandingByTenantId;
    }

    private static boolean hasStudioAccess(TenantMembership membership) {
        Set<Role> roles = membership.getRoles();
        return roles.contains(Role.EDITOR) || roles.contains(Role.TENANT_ADMIN);
    }

    private Optional<String> resolveRoutingHost(Long tenantId) {
        List<TenantDomain> domains = tenantDomainRepository.findVerifiedByTenantIdOrderByPrimaryDescIdAsc(
                tenantId
        );
        if (domains.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(domains.getFirst().getHost());
    }

    private BadCredentialsException invalidCredentials() {
        return new BadCredentialsException("Invalid credentials");
    }

    private String missingUserEncodedPassword() {
        String value = missingUserEncodedPassword;
        if (value == null) {
            synchronized (this) {
                value = missingUserEncodedPassword;
                if (value == null) {
                    value = passwordEncoder.encode(UUID.randomUUID().toString());
                    missingUserEncodedPassword = value;
                }
            }
        }
        return value;
    }

    private record EligibleTenant(Tenant tenant, String host) {
    }

    public record StudioWorkspaceView(
            Long tenantId,
            String slug,
            String name,
            String host,
            String faviconUrl,
            String logoUrl
    ) {
    }
}
