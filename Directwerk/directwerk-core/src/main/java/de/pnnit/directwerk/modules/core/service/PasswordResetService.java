package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.PasswordResetToken;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.PasswordResetTokenRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.PasswordPolicy;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    public static final java.time.Duration RESET_TOKEN_LIFETIME = java.time.Duration.of(1, ChronoUnit.HOURS);

    private final TransactionalEmailNotifier transactionalEmailNotifier;

    @Transactional
    public String requestReset(String email) {
        Optional<User> user = userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email));
        if (user.isEmpty()) {
            return null;
        }

        User lockedUser = userRepository.findWithLockById(user.get().getId())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        Instant now = Instant.now();
        passwordResetTokenRepository.revokeActiveTokensForUser(lockedUser.getId(), now);

        String rawToken = TokenHashUtil.generateUrlSafeToken(32);
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(lockedUser);
        token.setTokenHash(TokenHashUtil.sha256Hex(rawToken));
        token.setExpiresAt(now.plus(RESET_TOKEN_LIFETIME));
        passwordResetTokenRepository.save(token);

        transactionalEmailNotifier.sendPasswordReset(lockedUser.getEmail(), rawToken, RESET_TOKEN_LIFETIME);
        log.info("Password reset token issued");
        return rawToken;
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (!StringUtils.hasText(token)) {
            throw new IllegalArgumentException("Reset token is required");
        }
        PasswordPolicy.validate(newPassword);

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(TokenHashUtil.sha256Hex(token.trim()), Instant.now())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token"));

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        resetToken.setUsedAt(Instant.now());
        userRepository.save(user);
        passwordResetTokenRepository.save(resetToken);
    }
}
