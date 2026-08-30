package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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
    private final PasswordEncoder passwordEncoder;

    private volatile String missingUserEncodedPassword;

    /**
     * Verifies credentials and returns active editor/admin workspaces with a verified routing host.
     *
     * @param email    account email
     * @param password account password
     * @return workspaces sorted by tenant name
     * @throws BadCredentialsException when email/password do not match an active account
     * @throws StudioAccessDeniedException when the account has no studio-eligible memberships
     */
    @Transactional(readOnly = true)
    public List<StudioWorkspaceView> discoverWorkspaces(String email, String password) {
        PasswordPolicy.validate(password);

        User user = userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .filter(found -> found.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(this::invalidCredentials);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            passwordEncoder.matches(password, missingUserEncodedPassword());
            throw invalidCredentials();
        }

        List<TenantMembership> memberships = tenantMembershipRepository.findActiveMembershipsByUserId(
                user.getId(),
                MembershipStatus.ACTIVE
        );

        List<StudioWorkspaceView> workspaces = new ArrayList<>();
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
            workspaces.add(new StudioWorkspaceView(
                    tenant.getId(),
                    tenant.getSlug(),
                    tenant.getName(),
                    host.get()
            ));
        }

        workspaces.sort(Comparator.comparing(StudioWorkspaceView::name, String.CASE_INSENSITIVE_ORDER));

        if (workspaces.isEmpty()) {
            throw new StudioAccessDeniedException();
        }

        return workspaces;
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

    public record StudioWorkspaceView(Long tenantId, String slug, String name, String host) {
    }
}
