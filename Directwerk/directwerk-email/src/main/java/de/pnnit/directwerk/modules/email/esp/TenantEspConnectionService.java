package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.EnvelopeTokenProtector;
import de.pnnit.directwerk.modules.email.entity.EspConnectionStatus;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.entity.TenantEspConnection;
import de.pnnit.directwerk.modules.email.repository.TenantEspConnectionRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantEspConnectionService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final TenantEspConnectionRepository tenantEspConnectionRepository;
    private final TenantRepository tenantRepository;
    private final EnvelopeTokenProtector envelopeTokenProtector;

    @Transactional(readOnly = true)
    public Optional<TenantEspConnection> find(Long tenantId) {
        return tenantEspConnectionRepository.findByTenant_Id(tenantId);
    }

    @Transactional(readOnly = true)
    public Optional<ResolvedEspCredentials> resolveActiveMailgun(Long tenantId) {
        return find(tenantId)
                .filter(connection -> connection.getStatus() == EspConnectionStatus.CONNECTED)
                .filter(connection -> connection.getProvider() == EspProvider.MAILGUN)
                .map(connection -> new ResolvedEspCredentials(
                        connection.getProvider(),
                        connection.getDomain(),
                        connection.getFromEmail(),
                        connection.getFromName(),
                        connection.getRegion(),
                        envelopeTokenProtector.reveal(connection.getApiKeyCiphertext())
                ));
    }

    @Transactional
    public TenantEspConnection upsertMailgun(
            Long tenantId,
            String domain,
            String fromEmail,
            String fromName,
            String region,
            String apiKey
    ) {
        String normalizedDomain = requireText(domain, "domain").toLowerCase(Locale.ROOT);
        String normalizedFrom = requireText(fromEmail, "fromEmail").toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(normalizedFrom).matches()) {
            throw new IllegalArgumentException("fromEmail must be a valid email address");
        }
        String normalizedRegion = normalizeRegion(region);
        String normalizedKey = requireText(apiKey, "apiKey");

        TenantEspConnection connection = tenantEspConnectionRepository.findByTenant_Id(tenantId)
                .orElseGet(TenantEspConnection::new);
        connection.setTenant(tenantRepository.getReferenceById(tenantId));
        connection.setProvider(EspProvider.MAILGUN);
        connection.setDomain(normalizedDomain);
        connection.setFromEmail(normalizedFrom);
        connection.setFromName(StringUtils.hasText(fromName) ? fromName.trim() : null);
        connection.setRegion(normalizedRegion);
        connection.setApiKeyCiphertext(envelopeTokenProtector.protect(normalizedKey));
        connection.setStatus(EspConnectionStatus.CONNECTED);
        connection.setConnectedAt(Instant.now());
        return tenantEspConnectionRepository.save(connection);
    }

    @Transactional
    public void disconnect(Long tenantId) {
        tenantEspConnectionRepository.findByTenant_Id(tenantId)
                .ifPresent(tenantEspConnectionRepository::delete);
    }

    public record ResolvedEspCredentials(
            EspProvider provider,
            String domain,
            String fromEmail,
            String fromName,
            String region,
            String apiKey
    ) {
    }

    public record EspConnectionView(
            String provider,
            String domain,
            String fromEmail,
            String fromName,
            String region,
            String status,
            Instant connectedAt,
            boolean apiKeyConfigured
    ) {
    }

    public static EspConnectionView toView(TenantEspConnection connection) {
        return new EspConnectionView(
                connection.getProvider().name(),
                connection.getDomain(),
                connection.getFromEmail(),
                connection.getFromName(),
                connection.getRegion(),
                connection.getStatus().name(),
                connection.getConnectedAt(),
                StringUtils.hasText(connection.getApiKeyCiphertext())
        );
    }

    private static String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }

    private static String normalizeRegion(String region) {
        if (!StringUtils.hasText(region)) {
            return "EU";
        }
        String normalized = region.trim().toUpperCase(Locale.ROOT);
        if (!normalized.equals("EU") && !normalized.equals("US")) {
            throw new IllegalArgumentException("region must be EU or US");
        }
        return normalized;
    }
}
