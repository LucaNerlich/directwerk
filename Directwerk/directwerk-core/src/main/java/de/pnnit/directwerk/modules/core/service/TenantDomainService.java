package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.util.TenantHostname;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantDomainService {

    public static final String DNS_TXT_PREFIX = "directwerk-verify=";

    private final TenantDomainRepository tenantDomainRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkCacheEviction cacheEviction;
    private final DomainDnsLookup domainDnsLookup;
    private final PlatformAuditService platformAuditService;
    private final ApplicationEventPublisher eventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Lists all domains registered for a tenant.
     *
     * @param tenantId the tenant identifier
     * @return the tenant's registered domains
     */
    @Transactional(readOnly = true)
    public List<TenantDomain> listDomains(Long tenantId) {
        return tenantDomainRepository.findByTenantId(tenantId);
    }

    /**
     * Registers a domain for a tenant and optionally marks it as the tenant's primary domain.
     *
     * @param tenantId the tenant that owns the domain
     * @param host     the domain hostname to register
     * @param primary  whether the domain should be the tenant's primary domain
     * @return the persisted domain
     * @throws DomainAlreadyExistsException if the hostname is already registered
     * @throws IllegalStateException        if the tenant already has a primary domain
     */
    @Transactional
    public TenantDomain addDomain(Long tenantId, String host, boolean primary) {
        String normalizedHost = TenantHostname.normalize(host);
        boolean exists = TenantContext.callWithoutTenant(() ->
                tenantDomainRepository.findByHostIgnoreCase(normalizedHost).isPresent()
        );
        if (exists) {
            throw new DomainAlreadyExistsException(normalizedHost);
        }

        if (primary) {
            clearPrimaryDomains(tenantId);
        }

        TenantDomain domain = new TenantDomain();
        domain.setHost(normalizedHost);
        domain.setPrimary(primary);
        domain.setVerified(false);
        domain.setVerificationToken(generateVerificationToken());
        domain.setTenant(tenantRepository.getReferenceById(tenantId));
        try {
            TenantDomain saved = tenantDomainRepository.saveAndFlush(domain);
            cacheEviction.evictHostAfterCommit(normalizedHost);
            if (primary) {
                eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(tenantId));
            }
            platformAuditService.record(
                    PlatformAuditActions.DOMAIN_ADDED,
                    tenantId,
                    Map.of("host", normalizedHost, "primary", primary)
            );
            return saved;
        } catch (DataIntegrityViolationException ex) {
            String causeMessage = ex.getMostSpecificCause().getMessage();
            if (causeMessage != null && (
                    causeMessage.contains("uq_tenant_domains_host")
                            || causeMessage.contains("tenant_domains_host_key")
                            || causeMessage.contains("uq_tenant_domains_one_primary_per_tenant")
            )) {
                if (causeMessage.contains("uq_tenant_domains_one_primary_per_tenant")) {
                    throw new IllegalStateException("Tenant already has a primary domain", ex);
                }
                throw new DomainAlreadyExistsException(normalizedHost, ex);
            }
            throw ex;
        }
    }

    /**
     * Creates the DNS TXT verification challenge for an unverified domain.
     *
     * @param tenantId the tenant identifier
     * @param host     the domain host
     * @return the domain's verification token, expected DNS TXT value, and DNS name hint
     * @throws DomainVerificationException if the domain is not found or is already verified
     */
    // Not readOnly: ensureToken may generate and persist a token for legacy rows that
    // lack one, which is a write.
    @Transactional
    public DomainVerificationChallenge getVerificationChallenge(Long tenantId, String host) {
        TenantDomain domain = requireDomain(tenantId, host);
        if (domain.isVerified()) {
            throw new DomainVerificationException("Domain is already verified: " + domain.getHost());
        }
        ensureToken(domain);
        return new DomainVerificationChallenge(
                domain.getHost(),
                domain.getVerificationToken(),
                DNS_TXT_PREFIX + domain.getVerificationToken(),
                "_directwerk-challenge." + domain.getHost()
        );
    }

    /** Verifies domain ownership using a DNS TXT record. */
    @Transactional
    public TenantDomain verifyDomain(Long tenantId, String host) {
        TenantDomain domain = requireDomainForVerification(tenantId, host);
        if (domain.isVerified()) return domain;
        boolean dnsMatched = domainDnsLookup.lookupTxt(domain.getHost()).stream()
                .anyMatch(value -> matchesVerificationRecord(value, domain.getVerificationToken()));
        if (!dnsMatched) throw new DomainVerificationException(
                "Domain verification failed for " + domain.getHost()
                        + ". Publish a TXT record with value "
                        + DNS_TXT_PREFIX + domain.getVerificationToken());
        return persistVerification(tenantId, host, true);
    }

    /**
     * Persists the verification state in a short transactional phase.
     *
     * @param tenantId   the tenant identifier
     * @param host       the domain host to verify
     * @param dnsMatched whether DNS verification succeeded
     * @return the verified domain
     */
    @Transactional
    protected TenantDomain persistVerification(Long tenantId, String host, boolean dnsMatched) {
        TenantDomain domain = requireDomain(tenantId, host);
        if (domain.isVerified()) {
            return domain;
        }

        domain.setVerified(true);
        domain.setVerifiedAt(Instant.now());
        TenantDomain saved = tenantDomainRepository.saveAndFlush(domain);
        cacheEviction.evictHostAfterCommit(saved.getHost());
        eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(tenantId));
        platformAuditService.record(
                PlatformAuditActions.DOMAIN_VERIFIED,
                tenantId,
                Map.of(
                        "host", saved.getHost(),
                        "method", dnsMatched ? "DNS_TXT" : "TOKEN"
                )
        );
        return saved;
    }

    /**
     * Retrieves a tenant domain for verification, ensuring it has a verification token.
     *
     * @param tenantId the tenant identifier
     * @param host the domain host to look up
     * @return the matching tenant domain with verification token
     * @throws DomainVerificationException if the domain is not found
     */
    @Transactional
    protected TenantDomain requireDomainForVerification(Long tenantId, String host) {
        TenantDomain domain = requireDomain(tenantId, host);
        ensureToken(domain);
        return domain;
    }

    /**
     * Forces a domain into the verified state.
     *
     * @param tenantId the identifier of the tenant that owns the domain
     * @param host     the domain host to verify
     * @return the verified domain
     */
    @Transactional
    public TenantDomain forceVerifyDomain(Long tenantId, String host) {
        TenantDomain domain = requireDomain(tenantId, host);
        if (!domain.isVerified()) {
            domain.setVerified(true);
            domain.setVerifiedAt(Instant.now());
            domain = tenantDomainRepository.saveAndFlush(domain);
            cacheEviction.evictHostAfterCommit(domain.getHost());
            eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(tenantId));
        }
        platformAuditService.record(
                PlatformAuditActions.DOMAIN_FORCE_VERIFIED,
                tenantId,
                Map.of("host", domain.getHost())
        );
        return domain;
    }

    /**
     * Retrieves a tenant domain by host.
     *
     * @param tenantId the tenant identifier
     * @param host the domain host to look up
     * @return the matching tenant domain
     * @throws DomainVerificationException if the domain is not found
     */
    private TenantDomain requireDomain(Long tenantId, String host) {
        String normalizedHost = TenantHostname.normalize(host);
        return tenantDomainRepository.findByTenantIdAndHostIgnoreCase(tenantId, normalizedHost)
                .orElseThrow(() -> new DomainVerificationException("Domain not found: " + normalizedHost));
    }

    /**
     * Ensures that the domain has a verification token, generating and persisting one when needed.
     *
     * @param domain the domain whose verification token is initialized
     */
    private void ensureToken(TenantDomain domain) {
        if (!StringUtils.hasText(domain.getVerificationToken())) {
            domain.setVerificationToken(generateVerificationToken());
            tenantDomainRepository.saveAndFlush(domain);
        }
    }

    /**
     * Determines whether a DNS TXT value contains the expected verification token.
     *
     * @param txtValue the DNS TXT value to inspect
     * @param token the expected verification token
     * @return {@code true} if the trimmed value matches the token or its supported prefixed form, {@code false} otherwise
     */
    private boolean matchesVerificationRecord(String txtValue, String token) {
        if (!StringUtils.hasText(txtValue) || !StringUtils.hasText(token)) {
            return false;
        }
        String normalized = txtValue.trim();
        return normalized.equals(token)
                || normalized.equals(DNS_TXT_PREFIX + token)
                || normalized.endsWith(DNS_TXT_PREFIX + token);
    }

    /**
     * Generates a cryptographically random hexadecimal verification token.
     *
     * @return a 32-character hexadecimal verification token
     */
    private String generateVerificationToken() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * Clears the primary designation from all domains belonging to a tenant.
     *
     * @param tenantId the tenant whose primary domains should be cleared
     */
    private void clearPrimaryDomains(Long tenantId) {
        for (TenantDomain existing : tenantDomainRepository.findByTenantId(tenantId)) {
            if (existing.isPrimary()) {
                existing.setPrimary(false);
                tenantDomainRepository.saveAndFlush(existing);
            }
        }
    }

    public record DomainVerificationChallenge(
            String host,
            String token,
            String dnsTxtValue,
            String dnsNameHint
    ) {
    }
}
