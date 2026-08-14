package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class DirectwerkUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final PlatformAdminRepository platformAdminRepository;
    private final TenantResolver tenantResolver;

    @Override
    public UserDetails loadUserByUsername(String email) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .filter(found -> found.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new UsernameNotFoundException(email));

        if (LoginContext.isPlatformAdminLogin()) {
            platformAdminRepository.findByUserId(user.getId())
                    .orElseThrow(() -> new UsernameNotFoundException(email));
            return DirectwerkUserPrincipal.platformAdmin(user);
        }

        Tenant tenant = resolveTenantForLogin()
                .orElseThrow(() -> new TenantNotFoundException("Host required for tenant login"));
        if (tenant.getStatus() == TenantStatus.SUSPENDED) {
            throw new TenantSuspendedException(tenant.getSlug());
        }

        TenantMembership membership = tenantMembershipRepository
                .findByUserIdAndTenantId(user.getId(), tenant.getId())
                .filter(this::isLoginAllowed)
                .orElseThrow(() -> new UsernameNotFoundException(email));

        return DirectwerkUserPrincipal.tenantUser(user, tenant.getId(), membership.getRoles());
    }

    private boolean isLoginAllowed(TenantMembership membership) {
        return membership.getStatus() == MembershipStatus.ACTIVE;
    }

    private Optional<Tenant> resolveTenantForLogin() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return Optional.empty();
        }
        HttpServletRequest request = attributes.getRequest();
        return tenantResolver.resolveHost(request.getServerName());
    }
}
