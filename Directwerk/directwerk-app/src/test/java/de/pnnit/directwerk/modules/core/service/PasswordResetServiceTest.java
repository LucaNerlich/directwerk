package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.PasswordResetToken;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.event.PasswordChangedEvent;
import de.pnnit.directwerk.modules.core.repository.PasswordResetTokenRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TransactionalEmailNotifier transactionalEmailNotifier;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private PasswordResetService service;

    @Test
    void requestResetStoresHashedTokenAndEnqueuesEmail() {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findWithLockById(1L)).thenReturn(Optional.of(user));
        when(passwordResetTokenRepository.revokeActiveTokensForUser(eq(1L), any())).thenReturn(1);
        when(passwordResetTokenRepository.save(any(PasswordResetToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        String rawToken = service.requestReset("user@example.com");

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(passwordResetTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getTokenHash()).isEqualTo(TokenHashUtil.sha256Hex(rawToken));
        verify(transactionalEmailNotifier).sendPasswordReset(
                "user@example.com",
                rawToken,
                PasswordResetService.RESET_TOKEN_LIFETIME
        );
    }

    @Test
    void resetPasswordValidatesPolicyAndMarksTokenUsed() {
        String rawToken = TokenHashUtil.generateUrlSafeToken(32);
        User user = new User();
        user.setId(1L);
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUser(user);
        when(passwordResetTokenRepository.findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(
                eq(TokenHashUtil.sha256Hex(rawToken)),
                any()
        )).thenReturn(Optional.of(resetToken));
        when(passwordEncoder.encode("new-password-1")).thenReturn("encoded");

        service.resetPassword(rawToken, "new-password-1");

        assertThat(resetToken.getUsedAt()).isNotNull();
        verify(userRepository).save(user);
        verify(eventPublisher).publishEvent(any(PasswordChangedEvent.class));
    }

    @Test
    void resetPasswordRejectsShortPassword() {
        assertThatThrownBy(() -> service.resetPassword("token", "short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("8 and 128");
    }
}
