package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.InvitationTokenRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final String INVALID_TOKEN_MESSAGE = "Invalid, expired, or already used verification token";

    private final InvitationTokenService invitationTokenService;
    private final TransactionalEmailNotifier transactionalEmailNotifier;
    private final InvitationTokenRepository invitationTokenRepository;
    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final Clock clock;

    @Transactional
    public void issueVerificationEmail(User user, TenantMembership membership, Tenant tenant) {
        String token = invitationTokenService.issue(user, membership, InvitationType.EMAIL_VERIFICATION);
        transactionalEmailNotifier.sendEmailVerification(
                tenant.getId(),
                user.getEmail(),
                user.getName(),
                token,
                InvitationTokenService.tokenLifetime()
        );
    }

    @Transactional
    public User verify(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
        }

        InvitationToken token = invitationTokenRepository.findByTokenHash(
                        InvitationTokenService.hashToken(rawToken.trim())
                )
                .filter(candidate -> candidate.getUsedAt() == null)
                .filter(candidate -> candidate.getExpiresAt().isAfter(clock.instant()))
                .filter(candidate -> candidate.getType() == InvitationType.EMAIL_VERIFICATION)
                .orElseThrow(() -> new IllegalArgumentException(INVALID_TOKEN_MESSAGE));

        User user = token.getUser();
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        TenantMembership membership = token.getTenantMembership();
        if (membership != null && membership.getStatus() == MembershipStatus.INVITED) {
            membership.setStatus(MembershipStatus.ACTIVE);
            tenantMembershipRepository.save(membership);
        }

        token.setUsedAt(clock.instant());
        invitationTokenRepository.save(token);
        return user;
    }
}
