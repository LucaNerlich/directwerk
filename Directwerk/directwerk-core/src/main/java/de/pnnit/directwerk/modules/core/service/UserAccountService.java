package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.EnumSet;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class UserAccountService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final DirectwerkConfig directwerkConfig;
    private final EmailVerificationService emailVerificationService;

    @Transactional(readOnly = true)
    public java.util.Optional<AccountView> findAccount(Long userId) {
        return userRepository.findById(userId).map(account -> new AccountView(
                account.getId(),
                account.getEmail(),
                account.getName()
        ));
    }

    public record AccountView(Long id, String email, String name) {
    }

    @Transactional
    public User register(String email, String password, String name, Long tenantId) {
        PasswordPolicy.validate(password);
        String normalizedEmail = EmailNormalizer.normalize(email);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));
        if (!tenant.isActive()) {
            throw new TenantSuspendedException(tenant.getSlug());
        }

        Optional<User> existingUser = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            Optional<TenantMembership> existingMembership = tenantMembershipRepository
                    .findByUserIdAndTenantId(user.getId(), tenant.getId());
            if (existingMembership.filter(membership -> membership.getStatus() == MembershipStatus.ACTIVE).isPresent()) {
                throw new ConflictException(ConflictCodes.USER_EXISTS, "User already registered on this tenant");
            }
            if (existingMembership.filter(membership -> membership.getStatus() != MembershipStatus.INVITED).isPresent()) {
                throw new IllegalStateException("User membership cannot be activated");
            }

            verifyAccountOwnership(user, password);
            if (existingMembership.isPresent()) {
                if (directwerkConfig.isEmailVerificationRequired()) {
                    // When email verification is enabled, preserve INVITED status
                    // and issue verification email; EmailVerificationService.verify will activate later
                    applyRegistrationCredentials(user, password, name);
                    notifyVerificationIfRequired(user, existingMembership.get(), tenant);
                } else {
                    activateInvitedMembership(user, existingMembership.get(), password, name);
                }
            } else {
                applyRegistrationCredentials(user, password, name);
                TenantMembership membership = createSubscriberMembership(user, tenant);
                notifyVerificationIfRequired(user, membership, tenant);
            }
            return user;
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setName(name);
        user.setStatus(initialUserStatus());
        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent registration raced us to the uq_users_email unique
            // index — surface the same 409 USER_EXISTS as the pre-check.
            throw new ConflictException(ConflictCodes.USER_EXISTS, "User already registered on this tenant");
        }
        TenantMembership membership = createSubscriberMembership(user, tenant);
        notifyVerificationIfRequired(user, membership, tenant);
        return user;
    }

    private UserStatus initialUserStatus() {
        return directwerkConfig.isEmailVerificationRequired()
                ? UserStatus.PENDING_VERIFICATION
                : UserStatus.ACTIVE;
    }

    private MembershipStatus initialMembershipStatus() {
        return directwerkConfig.isEmailVerificationRequired()
                ? MembershipStatus.INVITED
                : MembershipStatus.ACTIVE;
    }

    private TenantMembership createSubscriberMembership(User user, Tenant tenant) {
        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setTenant(tenant);
        membership.setRoles(EnumSet.of(Role.SUBSCRIBER));
        membership.setStatus(initialMembershipStatus());
        return tenantMembershipRepository.save(membership);
    }

    private void notifyVerificationIfRequired(User user, TenantMembership membership, Tenant tenant) {
        if (!directwerkConfig.isEmailVerificationRequired()) {
            return;
        }
        emailVerificationService.issueVerificationEmail(user, membership, tenant);
    }

    private void verifyAccountOwnership(User user, String password) {
        if (isAuthenticatedAs(user)) {
            return;
        }
        if (StringUtils.hasText(user.getPasswordHash()) && passwordEncoder.matches(password, user.getPasswordHash())) {
            return;
        }
        throw new IllegalArgumentException("Account ownership verification failed");
    }

    private void applyRegistrationCredentials(User user, String password, String name) {
        if (StringUtils.hasText(name)) {
            user.setName(name);
        }
        user.setPasswordHash(passwordEncoder.encode(password));
        if (!directwerkConfig.isEmailVerificationRequired()) {
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);
    }

    private void activateInvitedMembership(
            User user,
            TenantMembership membership,
            String password,
            String name
    ) {
        applyRegistrationCredentials(user, password, name);
        membership.setStatus(MembershipStatus.ACTIVE);
        tenantMembershipRepository.save(membership);
    }

    private boolean isAuthenticatedAs(User user) {
        DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
        return principal != null && principal.userId().equals(user.getId());
    }
}
