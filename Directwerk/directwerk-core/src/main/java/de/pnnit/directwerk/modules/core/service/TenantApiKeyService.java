package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantApiKey;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantApiKeyRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantApiKeyService {

    public static final String KEY_PREFIX = "dwk_";
    private static final int PREFIX_BYTES = 4;
    private static final int SECRET_BYTES = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TenantApiKeyRepository tenantApiKeyRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public record IssuedApiKey(TenantApiKey key, String rawSecret) {
    }

    public record AuthenticatedApiKey(
            Long keyId,
            Long tenantId,
            Long createdByUserId,
            String createdByEmail,
            Set<String> scopes
    ) {
    }

    @Transactional(readOnly = true)
    public List<TenantApiKey> listActive(Long tenantId) {
        return tenantApiKeyRepository.findByTenantIdAndRevokedAtIsNullOrderByCreatedAtDesc(tenantId);
    }

    @Transactional
    public IssuedApiKey create(Long tenantId, Long createdByUserId, String name, Set<String> scopes) {
        String trimmedName = requireName(name);
        Set<String> normalizedScopes = TenantApiKeyScopes.normalize(scopes);

        Tenant tenant = tenantRepository.requireById(tenantId);
        User creator = userRepository.findById(createdByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Creating user not found: " + createdByUserId));

        String prefix = randomPrefix();
        String rawSecret;
        String tokenHash;
        do {
            rawSecret = KEY_PREFIX + prefix + "_" + TokenHashUtil.generateUrlSafeToken(SECRET_BYTES);
            tokenHash = TokenHashUtil.sha256Hex(rawSecret);
        } while (tenantApiKeyRepository.existsByTokenHash(tokenHash));

        TenantApiKey key = new TenantApiKey();
        key.setTenant(tenant);
        key.setName(trimmedName);
        key.setPrefix(prefix);
        key.setTokenHash(tokenHash);
        key.setScopes(normalizedScopes);
        key.setCreatedBy(creator);
        tenantApiKeyRepository.save(key);
        return new IssuedApiKey(key, rawSecret);
    }

    @Transactional
    public TenantApiKey revoke(Long tenantId, Long keyId) {
        TenantApiKey key = tenantApiKeyRepository.findByTenantIdAndId(tenantId, keyId)
                .orElseThrow(() -> new TenantApiKeyNotFoundException(keyId));
        if (key.getRevokedAt() == null) {
            key.setRevokedAt(clock.instant());
            tenantApiKeyRepository.save(key);
        }
        return key;
    }

    /**
     * Resolves a usable API key from a raw Bearer secret. Returns empty for unknown, revoked,
     * expired, or inactive-tenant keys. Never logs the raw secret.
     */
    @Transactional
    public Optional<AuthenticatedApiKey> authenticate(String rawSecret) {
        if (rawSecret == null || !rawSecret.startsWith(KEY_PREFIX)) {
            return Optional.empty();
        }
        String tokenHash = TokenHashUtil.sha256Hex(rawSecret);
        Optional<TenantApiKey> found = tenantApiKeyRepository.findByTokenHashWithTenant(tokenHash);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        TenantApiKey key = found.get();
        Instant now = clock.instant();
        if (!key.isUsable(now)) {
            return Optional.empty();
        }
        Tenant tenant = key.getTenant();
        if (tenant == null || tenant.getStatus() != TenantStatus.ACTIVE) {
            return Optional.empty();
        }
        key.setLastUsedAt(now);
        tenantApiKeyRepository.save(key);
        User creator = key.getCreatedBy();
        return Optional.of(new AuthenticatedApiKey(
                key.getId(),
                key.getTenantId() != null ? key.getTenantId() : tenant.getId(),
                creator.getId(),
                creator.getEmail(),
                Set.copyOf(key.getScopes())
        ));
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("API key name is required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > 100) {
            throw new IllegalArgumentException("API key name must be at most 100 characters");
        }
        return trimmed;
    }

    private static String randomPrefix() {
        byte[] bytes = new byte[PREFIX_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes).toLowerCase(Locale.ROOT);
    }
}
