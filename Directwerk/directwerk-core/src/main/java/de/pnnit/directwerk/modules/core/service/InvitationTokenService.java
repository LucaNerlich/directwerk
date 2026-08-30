package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.InvitationTokenRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InvitationTokenService {

    private static final Duration TOKEN_LIFETIME = Duration.ofHours(24);

    public static Duration tokenLifetime() {
        return TOKEN_LIFETIME;
    }

    private final InvitationTokenRepository invitationTokenRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Transactional
    public String issue(User user, TenantMembership membership, InvitationType type) {
        if (type == null) {
            throw new IllegalArgumentException("Invitation type is required");
        }
        if (type == InvitationType.PLATFORM_ADMIN && membership != null) {
            throw new IllegalArgumentException("PLATFORM_ADMIN invitation must not have a tenant membership");
        }
        if (type != InvitationType.PLATFORM_ADMIN && membership == null) {
            throw new IllegalArgumentException("Tenant-scoped invitation must have a tenant membership");
        }

        User lockedUser = userRepository.findWithLockById(user.getId())
                .orElseThrow(() -> new IllegalStateException("User not found: " + user.getId()));

        invalidateActiveTokens(lockedUser.getId(), type, membership != null ? membership.getId() : null);

        String rawToken = TokenHashUtil.generateUrlSafeToken(32);

        InvitationToken token = new InvitationToken();
        token.setUser(lockedUser);
        token.setTenantMembership(membership);
        token.setType(type);
        token.setTokenHash(TokenHashUtil.sha256Hex(rawToken));
        token.setCreatedAt(clock.instant());
        token.setExpiresAt(clock.instant().plus(TOKEN_LIFETIME));
        invitationTokenRepository.save(token);
        return rawToken;
    }

    static String hashToken(String token) {
        return TokenHashUtil.sha256Hex(token);
    }

    private void invalidateActiveTokens(Long userId, InvitationType type, Long tenantMembershipId) {
        Instant now = clock.instant();
        invitationTokenRepository.findActiveByUserIdAndType(userId, type).stream()
                .filter(token -> matchesMembership(token, tenantMembershipId))
                .forEach(token -> {
                    token.setUsedAt(now);
                    invitationTokenRepository.save(token);
                });
    }

    private static boolean matchesMembership(InvitationToken token, Long tenantMembershipId) {
        if (token.getType() == InvitationType.PLATFORM_ADMIN) {
            return token.getTenantMembership() == null;
        }
        return token.getTenantMembership() != null
                && Objects.equals(tenantMembershipId, token.getTenantMembership().getId());
    }
}
