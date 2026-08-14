package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.InvitationTokenRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InvitationTokenServiceTest {

    @Mock
    private InvitationTokenRepository invitationTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    void issueStoresOnlySha256HashAndReturnsRawToken() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-17T12:00:00Z"), ZoneOffset.UTC);
        InvitationTokenService service = new InvitationTokenService(invitationTokenRepository, userRepository, clock);
        User user = new User();
        user.setId(10L);
        TenantMembership membership = new TenantMembership();
        membership.setId(20L);
        when(userRepository.findWithLockById(10L)).thenReturn(Optional.of(user));
        when(invitationTokenRepository.findActiveByUserIdAndType(10L, InvitationType.TENANT_MEMBER))
                .thenReturn(List.of());
        when(invitationTokenRepository.save(any(InvitationToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        String rawToken = service.issue(user, membership, InvitationType.TENANT_MEMBER);

        ArgumentCaptor<InvitationToken> captor = ArgumentCaptor.forClass(InvitationToken.class);
        verify(invitationTokenRepository).save(captor.capture());
        InvitationToken stored = captor.getValue();
        assertThat(rawToken).hasSizeGreaterThanOrEqualTo(43);
        assertThat(stored.getTokenHash()).isEqualTo(sha256HexIndependent(rawToken)).doesNotContain(rawToken);
        assertThat(stored.getUser()).isSameAs(user);
        assertThat(stored.getTenantMembership()).isSameAs(membership);
        assertThat(stored.getType()).isEqualTo(InvitationType.TENANT_MEMBER);
        assertThat(stored.getExpiresAt()).isAfter(clock.instant());
        assertThat(stored.getUsedAt()).isNull();
    }

    @Test
    void issueRejectsNullInvitationType() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-17T12:00:00Z"), ZoneOffset.UTC);
        InvitationTokenService service = new InvitationTokenService(invitationTokenRepository, userRepository, clock);
        User user = new User();
        user.setId(10L);
        TenantMembership membership = new TenantMembership();
        membership.setId(20L);

        assertThatThrownBy(() -> service.issue(user, membership, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invitation type is required");
    }

    @Test
    void issueInvalidatesPreviousActiveTokensForSameTarget() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-17T12:00:00Z"), ZoneOffset.UTC);
        InvitationTokenService service = new InvitationTokenService(invitationTokenRepository, userRepository, clock);
        User user = new User();
        user.setId(10L);
        TenantMembership membership = new TenantMembership();
        membership.setId(20L);
        InvitationToken previous = new InvitationToken();
        previous.setTenantMembership(membership);
        when(userRepository.findWithLockById(10L)).thenReturn(Optional.of(user));
        when(invitationTokenRepository.findActiveByUserIdAndType(10L, InvitationType.TENANT_MEMBER))
                .thenReturn(List.of(previous));
        when(invitationTokenRepository.save(any(InvitationToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.issue(user, membership, InvitationType.TENANT_MEMBER);

        assertThat(previous.getUsedAt()).isEqualTo(clock.instant());
        verify(invitationTokenRepository).save(previous);
    }

    private static String sha256HexIndependent(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
