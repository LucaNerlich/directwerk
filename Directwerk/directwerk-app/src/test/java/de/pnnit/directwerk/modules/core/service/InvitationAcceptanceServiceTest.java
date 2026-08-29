package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.InvitationToken;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.content.TenantMembershipActivatedEvent;
import de.pnnit.directwerk.modules.core.repository.InvitationTokenRepository;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class InvitationAcceptanceServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-17T12:00:00Z");

    @Mock
    private InvitationTokenRepository invitationTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private PlatformAdminRepository platformAdminRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private InvitationAcceptanceService service;

    @BeforeEach
    void setUp() {
        service = new InvitationAcceptanceService(
                invitationTokenRepository,
                userRepository,
                tenantMembershipRepository,
                platformAdminRepository,
                passwordEncoder,
                Clock.fixed(NOW, ZoneOffset.UTC),
                eventPublisher
        );
    }

    @Test
    void acceptActivatesUserAndTenantMembershipAndConsumesToken() {
        User user = pendingUser();
        Tenant tenant = new Tenant();
        tenant.setId(5L);
        TenantMembership membership = new TenantMembership();
        membership.setTenant(tenant);
        membership.setStatus(MembershipStatus.INVITED);
        InvitationToken token = token(user, membership, InvitationType.TENANT_MEMBER, NOW.plusSeconds(60), null);
        when(invitationTokenRepository.findByTokenHash(InvitationTokenService.hashToken("raw-token")))
                .thenReturn(Optional.of(token));
        when(passwordEncoder.encode("secure-password")).thenReturn("encoded");

        service.accept("raw-token", "secure-password", "Updated Name");

        assertThat(user.getPasswordHash()).isEqualTo("encoded");
        assertThat(user.getName()).isEqualTo("Updated Name");
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(membership.getStatus()).isEqualTo(MembershipStatus.ACTIVE);
        assertThat(token.getUsedAt()).isEqualTo(NOW);
        verify(userRepository).save(user);
        verify(tenantMembershipRepository).save(membership);
        verify(invitationTokenRepository).save(token);
        verify(eventPublisher).publishEvent(new TenantMembershipActivatedEvent(5L, 10L));
    }

    @Test
    void acceptPlatformAdminActivatesUserWithoutTenantMembership() {
        User user = pendingUser();
        InvitationToken token = token(user, null, InvitationType.PLATFORM_ADMIN, NOW.plusSeconds(60), null);
        when(invitationTokenRepository.findByTokenHash(InvitationTokenService.hashToken("platform-token")))
                .thenReturn(Optional.of(token));
        when(passwordEncoder.encode("secure-password")).thenReturn("encoded");
        when(platformAdminRepository.findByUserId(10L)).thenReturn(Optional.empty());
        when(platformAdminRepository.save(any(PlatformAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        service.accept("platform-token", "secure-password", null);

        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(token.getUsedAt()).isEqualTo(NOW);
        verify(tenantMembershipRepository, never()).save(any());
        verify(platformAdminRepository).save(any(PlatformAdmin.class));
    }

    @Test
    void acceptRejectsUnknownToken() {
        when(invitationTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accept("unknown", "secure-password", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid, expired, or already used invitation token");
    }

    @Test
    void acceptRejectsExpiredToken() {
        InvitationToken token = token(pendingUser(), null, InvitationType.PLATFORM_ADMIN, NOW.minusSeconds(1), null);
        when(invitationTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.accept("expired", "secure-password", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid, expired, or already used invitation token");
    }

    @Test
    void acceptRejectsReusedToken() {
        InvitationToken token = token(pendingUser(), null, InvitationType.PLATFORM_ADMIN, NOW.plusSeconds(60), NOW);
        when(invitationTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.accept("reused", "secure-password", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid, expired, or already used invitation token");
    }

    @Test
    void acceptJoinOnlyRejectsNonActiveUser() {
        User user = pendingUser();
        TenantMembership membership = new TenantMembership();
        membership.setStatus(MembershipStatus.INVITED);
        InvitationToken token = token(user, membership, InvitationType.TENANT_JOIN, NOW.plusSeconds(60), null);
        when(invitationTokenRepository.findByTokenHash(InvitationTokenService.hashToken("join-token")))
                .thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.accept("join-token", "secure-password", "Name"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid, expired, or already used invitation token");

        verify(userRepository, never()).save(any());
        verify(tenantMembershipRepository, never()).save(any());
    }

    @Test
    void acceptJoinOnlyDoesNotAlterActiveUserCredentials() {
        User user = new User();
        user.setId(10L);
        user.setEmail("active@example.com");
        user.setPasswordHash("existing-hash");
        user.setStatus(UserStatus.ACTIVE);
        Tenant tenant = new Tenant();
        tenant.setId(5L);
        TenantMembership membership = new TenantMembership();
        membership.setTenant(tenant);
        membership.setStatus(MembershipStatus.INVITED);
        InvitationToken token = token(user, membership, InvitationType.TENANT_JOIN, NOW.plusSeconds(60), null);
        when(invitationTokenRepository.findByTokenHash(InvitationTokenService.hashToken("join-token")))
                .thenReturn(Optional.of(token));

        service.accept("join-token", "attacker-password", "Hacker Name");

        assertThat(user.getPasswordHash()).isEqualTo("existing-hash");
        assertThat(user.getName()).isNull();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(membership.getStatus()).isEqualTo(MembershipStatus.ACTIVE);
        verify(passwordEncoder, never()).encode(any());
        verify(userRepository).save(user);
        verify(tenantMembershipRepository).save(membership);
    }

    private static User pendingUser() {
        User user = new User();
        user.setId(10L);
        user.setEmail("invited@example.com");
        user.setStatus(UserStatus.PENDING_VERIFICATION);
        return user;
    }

    private static InvitationToken token(
            User user,
            TenantMembership membership,
            InvitationType type,
            Instant expiresAt,
            Instant usedAt
    ) {
        InvitationToken token = new InvitationToken();
        token.setUser(user);
        token.setTenantMembership(membership);
        token.setType(type);
        token.setExpiresAt(expiresAt);
        token.setUsedAt(usedAt);
        return token;
    }
}
