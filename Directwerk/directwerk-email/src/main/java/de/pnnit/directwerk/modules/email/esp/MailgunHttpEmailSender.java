package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.EmailMessageValidator;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends one outbound email via Mailgun's HTTP Messages API using tenant credentials.
 */
@Component
public class MailgunHttpEmailSender {

    private static final Logger log = LoggerFactory.getLogger(MailgunHttpEmailSender.class);

    /**
     * A stalled Mailgun endpoint must fail into the queue's retry instead of blocking
     * {@code QueueWorker.pollAll()} (which is {@code @DisallowConcurrentExecution}) forever.
     */
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

    private final RestClient restClient;

    public MailgunHttpEmailSender(RestClient.Builder restClientBuilder) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        // clone() keeps the auto-configured builder untouched while inheriting its converters.
        this.restClient = restClientBuilder.clone().requestFactory(requestFactory).build();
    }

    public void send(TenantEspConnectionService.ResolvedEspCredentials credentials, OutboundEmail email) {
        if (credentials == null || email == null) {
            throw new EmailDeliveryException("Mailgun credentials and email payload are required");
        }
        String fromName = email.fromName() != null ? email.fromName() : credentials.fromName();
        String fromAddress = email.fromAddress() != null ? email.fromAddress() : credentials.fromEmail();
        // Same header/address validation the SMTP sender enforces: URL-encoding protects the
        // transport form, not the message headers Mailgun reconstructs from it.
        EmailMessageValidator.requireAddress("to", email.to());
        EmailMessageValidator.requireAddress("from", fromAddress);
        EmailMessageValidator.requireDisplayName(fromName);
        EmailMessageValidator.requireNoLineBreaks("subject", email.subject());
        EmailMessageValidator.requireNoLineBreaks("jobId", email.jobId());
        EmailMessageValidator.requireHeaders(email.headers());
        requireDomain(credentials.domain());
        String from = formatFrom(fromName, fromAddress);

        Map<String, String> form = new LinkedHashMap<>();
        form.put("from", from);
        form.put("to", email.to());
        form.put("subject", email.subject());
        if (StringUtils.hasText(email.htmlBody())) {
            form.put("html", email.htmlBody());
        }
        if (StringUtils.hasText(email.plainTextBody())) {
            form.put("text", email.plainTextBody());
        }
        if (email.headers() != null) {
            email.headers().forEach((name, value) -> {
                if (StringUtils.hasText(name) && StringUtils.hasText(value)) {
                    form.put("h:" + name, value);
                }
            });
        }

        String body = form.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));

        String auth = Base64.getEncoder().encodeToString(
                ("api:" + credentials.apiKey()).getBytes(StandardCharsets.UTF_8)
        );
        try {
            restClient
                    .post()
                    .uri(URI.create(apiBase(credentials.region()) + "/v3/" + credentials.domain() + "/messages"))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .header("Authorization", "Basic " + auth)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Sent email via Mailgun domain={} job={}", credentials.domain(), email.jobId());
        } catch (RestClientResponseException ex) {
            throw new EmailDeliveryException(
                    "Mailgun rejected the message (HTTP " + ex.getStatusCode().value() + ")",
                    ex
            );
        } catch (RuntimeException ex) {
            throw new EmailDeliveryException("Mailgun send failed", ex);
        }
    }

    private static String apiBase(String region) {
        return "EU".equals(region) ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
    }

    /** Guards the domain concatenated into the Mailgun API path (legacy rows may predate save-time validation). */
    private static void requireDomain(String domain) {
        if (!StringUtils.hasText(domain)
                || domain.chars().anyMatch(Character::isWhitespace)
                || domain.indexOf('/') >= 0
                || domain.indexOf('?') >= 0
                || domain.indexOf('#') >= 0) {
            throw new EmailDeliveryException("Mailgun domain is invalid");
        }
    }

    private static String formatFrom(String fromName, String fromEmail) {
        if (!StringUtils.hasText(fromName)) {
            return fromEmail;
        }
        return fromName.trim() + " <" + fromEmail + ">";
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
