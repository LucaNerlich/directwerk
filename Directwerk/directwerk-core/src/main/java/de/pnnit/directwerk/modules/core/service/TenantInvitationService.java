package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantInvitationService {

    private static final Logger log = LoggerFactory.getLogger(TenantInvitationService.class);
    private static final Set<Role> INVITABLE_ROLES = EnumSet.of(
            Role.TENANT_ADMIN,
            Role.EDITOR,
            Role.SUBSCRIBER,
            Role.GUEST
    );

    private final TenantRepository tenantRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final InvitationTokenService invitationTokenService;
    private final TransactionalEmailNotifier transactionalEmailNotifier;
    private final UserProvisioningService userProvisioningService;

    @Transactional
    public InvitationResult invite(Long tenantId, String email, String name, String roleName) {
        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Email is required");
        }
        if (!StringUtils.hasText(roleName)) {
            throw new IllegalArgumentException("Role is required");
        }

        Role role;
        try {
            role = Role.valueOf(roleName.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown role: " + roleName, ex);
        }
        if (!INVITABLE_ROLES.contains(role)) {
            throw new IllegalArgumentException("Role cannot be invited: " + role.name());
        }

        String normalizedEmail = EmailNormalizer.normalize(email);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));

        User user = userProvisioningService.findOrCreatePendingUser(normalizedEmail, name);

        Optional<TenantMembership> existingMembership = tenantMembershipRepository
                .findByUserIdAndTenantId(user.getId(), tenant.getId());
        if (existingMembership.map(membership -> membership.getStatus() == MembershipStatus.ACTIVE).orElse(false)) {
            throw new IllegalStateException("User is already an active member of this tenant");
        }

        TenantMembership membership = existingMembership.orElseGet(() -> {
            TenantMembership created = new TenantMembership();
            created.setUser(user);
            created.setTenant(tenant);
            return created;
        });

        membership.setRoles(EnumSet.of(role));
        membership.setStatus(MembershipStatus.INVITED);
        membership.setInvitedAt(Instant.now());
        membership = tenantMembershipRepository.save(membership);

        // Active users already have credentials — issue a join-only invite (no password setup).
        InvitationType invitationType = user.getStatus() == UserStatus.ACTIVE
                ? InvitationType.TENANT_JOIN
                : InvitationType.TENANT_MEMBER;
        String inviteToken = invitationTokenService.issue(user, membership, invitationType);
        deliverInvitation(
                tenant.getId(),
                user.getEmail(),
                user.getName(),
                tenant.getName(),
                tenant.getSlug(),
                role.name(),
                inviteToken
        );
        return new InvitationResult(user.getEmail(), role.name(), membership.getStatus().name(), inviteToken);
    }

    private void deliverInvitation(
            Long tenantId,
            String email,
            String recipientName,
            String tenantName,
            String tenantSlug,
            String role,
            String inviteToken
    ) {
        transactionalEmailNotifier.sendTenantInvitation(
                tenantId,
                email,
                recipientName,
                tenantName,
                role,
                inviteToken,
                InvitationTokenService.tokenLifetime()
        );
        log.info("Invitation queued for tenant={} role={}", tenantSlug, role);
    }

    public record InvitationResult(String email, String role, String status, String inviteToken) {
    }
}
