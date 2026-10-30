package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantApiKey;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantApiKeyRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantApiKeyServiceTest {

    @Mock
    private TenantApiKeyRepository tenantApiKeyRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private UserRepository userRepository;

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-30T12:00:00Z"), ZoneOffset.UTC);
    private TenantApiKeyService service;

    @BeforeEach
    void setUp() {
        service = new TenantApiKeyService(tenantApiKeyRepository, tenantRepository, userRepository, clock);
    }

    @Test
    void createStoresOnlyHashAndReturnsRawDwKSecret() {
        Tenant tenant = tenant(10L);
        User user = user(5L, "admin@example.com");
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(tenantApiKeyRepository.existsByTokenHash(anyString())).thenReturn(false);
        when(tenantApiKeyRepository.save(any(TenantApiKey.class))).thenAnswer(inv -> {
            TenantApiKey key = inv.getArgument(0);
            key.setId(42L);
            return key;
        });

        TenantApiKeyService.IssuedApiKey issued = service.create(
                10L, 5L, "Cursor MCP", Set.of(TenantApiKeyScopes.CONTENT_WRITE));

        assertThat(issued.rawSecret()).startsWith("dwk_");
        assertThat(issued.rawSecret()).contains("_");
        ArgumentCaptor<TenantApiKey> captor = ArgumentCaptor.forClass(TenantApiKey.class);
        verify(tenantApiKeyRepository).save(captor.capture());
        TenantApiKey stored = captor.getValue();
        assertThat(stored.getTokenHash()).isEqualTo(TokenHashUtil.sha256Hex(issued.rawSecret()));
        assertThat(stored.getTokenHash()).doesNotContain(issued.rawSecret());
        assertThat(stored.getPrefix()).isEqualTo(issued.key().getPrefix());
        assertThat(issued.rawSecret()).startsWith("dwk_" + stored.getPrefix() + "_");
        assertThat(stored.getScopes()).containsExactly(TenantApiKeyScopes.CONTENT_WRITE);
        assertThat(stored.getName()).isEqualTo("Cursor MCP");
        assertThat(stored.getCreatedBy()).isSameAs(user);
        assertThat(stored.getTenant()).isSameAs(tenant);
    }

    @Test
    void createRejectsUnknownScope() {
        assertThatThrownBy(() -> service.create(10L, 5L, "x", Set.of("admin:*")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported scope");
    }

    @Test
    void authenticateAcceptsActiveKeyAndTouchesLastUsed() {
        Tenant tenant = tenant(10L);
        User user = user(5L, "admin@example.com");
        String raw = "dwk_abcd1234_" + TokenHashUtil.generateUrlSafeToken(32);
        TenantApiKey key = new TenantApiKey();
        key.setId(7L);
        key.setTenant(tenant);
        key.setTenantId(10L);
        key.setCreatedBy(user);
        key.setScopes(Set.of(TenantApiKeyScopes.CONTENT_READ));
        key.setTokenHash(TokenHashUtil.sha256Hex(raw));
        when(tenantApiKeyRepository.findByTokenHashWithTenant(TokenHashUtil.sha256Hex(raw)))
                .thenReturn(Optional.of(key));
        when(tenantApiKeyRepository.save(any(TenantApiKey.class))).thenAnswer(inv -> inv.getArgument(0));

        Optional<TenantApiKeyService.AuthenticatedApiKey> auth = service.authenticate(raw);

        assertThat(auth).isPresent();
        assertThat(auth.get().keyId()).isEqualTo(7L);
        assertThat(auth.get().tenantId()).isEqualTo(10L);
        assertThat(auth.get().createdByUserId()).isEqualTo(5L);
        assertThat(key.getLastUsedAt()).isEqualTo(clock.instant());
    }

    @Test
    void authenticateRejectsRevokedKey() {
        Tenant tenant = tenant(10L);
        User user = user(5L, "admin@example.com");
        String raw = "dwk_abcd1234_" + TokenHashUtil.generateUrlSafeToken(32);
        TenantApiKey key = new TenantApiKey();
        key.setTenant(tenant);
        key.setCreatedBy(user);
        key.setScopes(Set.of(TenantApiKeyScopes.CONTENT_WRITE));
        key.setTokenHash(TokenHashUtil.sha256Hex(raw));
        key.setRevokedAt(clock.instant());
        when(tenantApiKeyRepository.findByTokenHashWithTenant(TokenHashUtil.sha256Hex(raw)))
                .thenReturn(Optional.of(key));

        assertThat(service.authenticate(raw)).isEmpty();
    }

    @Test
    void revokeSetsRevokedAt() {
        TenantApiKey key = new TenantApiKey();
        key.setId(9L);
        when(tenantApiKeyRepository.findByTenantIdAndId(10L, 9L)).thenReturn(Optional.of(key));
        when(tenantApiKeyRepository.save(any(TenantApiKey.class))).thenAnswer(inv -> inv.getArgument(0));

        TenantApiKey revoked = service.revoke(10L, 9L);

        assertThat(revoked.getRevokedAt()).isEqualTo(clock.instant());
    }

    @Test
    void revokeMissingKeyThrows() {
        when(tenantApiKeyRepository.findByTenantIdAndId(10L, 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.revoke(10L, 99L))
                .isInstanceOf(TenantApiKeyNotFoundException.class);
    }

    private static Tenant tenant(Long id) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenant;
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }
}
