package de.pnnit.directwerk.config;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.util.EnumSet;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
@Profile({"local", "docker"})
@Order(100)
@RequiredArgsConstructor
public class DevDataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final PlatformAdminRepository platformAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final DirectwerkConfig directwerkConfig;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedPlatformAdmin();
        seedUser("admin-a@alpha-show.local", "Tenant A Admin", "alpha-show-a", false, Role.TENANT_ADMIN, Role.EDITOR);
        seedUser("admin-b@alpha-show.local", "Tenant B Admin", "alpha-show-b", false, Role.TENANT_ADMIN, Role.EDITOR);
        seedUser("editor@alpha-show.local", "Test Editor", "alpha-show-a", false, Role.EDITOR);
    }

    private void seedPlatformAdmin() {
        String email = directwerkConfig.dev().platformAdminEmail();
        if (!StringUtils.hasText(email)) {
            return;
        }
        seedUser(email, "Platform Admin", null, true, directwerkConfig.dev().platformAdminPassword());
    }

    private void seedUser(
            String email,
            String name,
            String tenantSlug,
            boolean platformAdmin,
            Role... roles
    ) {
        seedUser(email, name, tenantSlug, platformAdmin, directwerkConfig.dev().seedPassword(), roles);
    }

    private void seedUser(
            String email,
            String name,
            String tenantSlug,
            boolean platformAdmin,
            String password,
            Role... roles
    ) {
        User user = userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            User created = new User();
            created.setEmail(email);
            created.setName(name);
            created.setStatus(UserStatus.ACTIVE);
            return userRepository.save(created);
        });

        applyPasswordIfNeeded(user, password);
        user.setName(name);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        if (platformAdmin) {
            platformAdminRepository.findByUserId(user.getId()).orElseGet(() -> {
                PlatformAdmin admin = new PlatformAdmin();
                admin.setUser(user);
                return platformAdminRepository.save(admin);
            });
            return;
        }

        Tenant tenant = tenantRepository.findBySlug(tenantSlug)
                .orElseThrow(() -> new IllegalStateException("Missing tenant: " + tenantSlug));
        tenantMembershipRepository.findByUserIdAndTenantId(user.getId(), tenant.getId())
                .ifPresentOrElse(
                        membership -> {
                            EnumSet<Role> seededRoles = EnumSet.copyOf(java.util.Arrays.asList(roles));
                            if (!membership.getRoles().equals(seededRoles)) {
                                membership.setRoles(seededRoles);
                                tenantMembershipRepository.save(membership);
                            }
                        },
                        () -> {
                            TenantMembership membership = new TenantMembership();
                            membership.setUser(user);
                            membership.setTenant(tenant);
                            membership.setRoles(EnumSet.copyOf(java.util.Arrays.asList(roles)));
                            tenantMembershipRepository.save(membership);
                        }
                );
    }

    private void applyPasswordIfNeeded(User user, String password) {
        if (!StringUtils.hasText(password)) {
            return;
        }
        if (StringUtils.hasText(user.getPasswordHash())) {
            return;
        }
        user.setPasswordHash(passwordEncoder.encode(password));
    }
}
