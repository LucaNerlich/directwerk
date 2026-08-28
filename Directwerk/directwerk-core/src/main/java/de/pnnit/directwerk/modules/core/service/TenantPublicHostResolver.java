package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.Comparator;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Resolves verified tenant public hostnames for RSS, enclosures, snapshots, and email links.
 */
@Service
@RequiredArgsConstructor
public class TenantPublicHostResolver {

    public enum HostPolicy {
        /** Use requested host when verified; otherwise primary verified domain. */
        TRUST_REQUEST,
        /** Always use primary verified domain (ignore request host). */
        PRIMARY
    }

    private final TenantDomainRepository tenantDomainRepository;

    @Transactional(readOnly = true)
    public String resolve(Long tenantId, String requestedHostname, HostPolicy policy) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required for host resolution");
        }
        if (policy == HostPolicy.TRUST_REQUEST && StringUtils.hasText(requestedHostname)) {
            String normalized = normalizeHost(requestedHostname);
            boolean allowListed = tenantDomainRepository
                    .findByTenantIdAndHostIgnoreCase(tenantId, normalized)
                    .filter(TenantDomain::isVerified)
                    .isPresent();
            if (allowListed) {
                return normalized;
            }
        }
        return primaryVerifiedHost(tenantId);
    }

    @Transactional(readOnly = true)
    public Optional<String> findPrimaryVerifiedHost(Long tenantId) {
        if (tenantId == null) {
            return Optional.empty();
        }
        return tenantDomainRepository.findByTenantId(tenantId).stream()
                .filter(TenantDomain::isVerified)
                .sorted(Comparator
                        .comparing(TenantDomain::isPrimary).reversed()
                        .thenComparing(TenantDomain::getId))
                .map(TenantDomain::getHost)
                .map(TenantPublicHostResolver::normalizeHost)
                .findFirst();
    }

    private String primaryVerifiedHost(Long tenantId) {
        return findPrimaryVerifiedHost(tenantId)
                .orElseThrow(() -> new IllegalStateException(
                        "No verified tenant domain available (tenantId=" + tenantId + ")"
                ));
    }

    private static String normalizeHost(String hostname) {
        return hostname.trim().toLowerCase(Locale.ROOT);
    }
}
