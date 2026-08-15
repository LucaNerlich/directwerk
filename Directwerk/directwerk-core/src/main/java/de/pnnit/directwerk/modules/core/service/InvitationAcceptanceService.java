package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.InvitationTokenRepository;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class InvitationAcceptanceService {

    private static final String INVALID_TOKEN_MESSAGE = "Invalid, expired, or already used invitation token";

    private final InvitationTokenRepository invitationTokenRepository;
    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final PlatformAdminRepository platformAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Transactional
    public User accept(String rawToken, String password, String name) {
        if (!StringUtils.hasText(rawToken)) {
            throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
        }

        InvitationToken token = invitationTokenRepository.findByTokenHash(
                        InvitationTokenService.hashToken(rawToken.trim())
                )
                .filter(candidate -> candidate.getUsedAt() == null)
                .filter(candidate -> candidate.getExpiresAt().isAfter(clock.instant()))
                .orElseThrow(() -> new IllegalArgumentException(INVALID_TOKEN_MESSAGE));

        User user = token.getUser();
        boolean joinOnly = token.getType() == InvitationType.TENANT_JOIN;
        boolean alreadyActive = user.getStatus() == UserStatus.ACTIVE;

        if (joinOnly) {
            if (!alreadyActive) {
                throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
            }
        } else if (alreadyActive) {
            // Active users must never have credentials rewritten.
        } else {
            PasswordPolicy.validate(password);
            user.setPasswordHash(passwordEncoder.encode(password));
            if (StringUtils.hasText(name)) {
                user.setName(name.trim());
            }
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);

        if (token.getType() == InvitationType.TENANT_MEMBER || token.getType() == InvitationType.TENANT_JOIN) {
            TenantMembership membership = token.getTenantMembership();
            if (membership == null || membership.getStatus() != MembershipStatus.INVITED) {
                throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
            }
            membership.setStatus(MembershipStatus.ACTIVE);
            tenantMembershipRepository.save(membership);
        }

        if (token.getType() == InvitationType.PLATFORM_ADMIN) {
            platformAdminRepository.findByUserId(user.getId()).orElseGet(() -> {
                PlatformAdmin admin = new PlatformAdmin();
                admin.setUser(user);
                return platformAdminRepository.save(admin);
            });
        }

        token.setUsedAt(clock.instant());
        invitationTokenRepository.save(token);
        return user;
    }
}
