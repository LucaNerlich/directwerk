package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
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

    private final RestClient.Builder restClientBuilder;

    public MailgunHttpEmailSender(RestClient.Builder restClientBuilder) {
        this.restClientBuilder = restClientBuilder;
    }

    public void send(TenantEspConnectionService.ResolvedEspCredentials credentials, OutboundEmail email) {
        if (credentials == null || email == null) {
            throw new EmailDeliveryException("Mailgun credentials and email payload are required");
        }
        String apiBase = "EU".equals(credentials.region())
                ? "https://api.eu.mailgun.net"
                : "https://api.mailgun.net";
        String from = formatFrom(email.fromName() != null ? email.fromName() : credentials.fromName(),
                email.fromAddress() != null ? email.fromAddress() : credentials.fromEmail());

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
            restClientBuilder.build()
                    .post()
                    .uri(URI.create(apiBase + "/v3/" + credentials.domain() + "/messages"))
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
