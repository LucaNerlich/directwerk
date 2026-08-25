package de.pnnit.directwerk.modules.webhook;

import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.net.URI;
import java.net.URISyntaxException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * Queue consumer for outbound webhook delivery jobs. Currently validation-only:
 * enforces a well-formed HTTPS target URL and payload bounds, then logs the
 * accepted job (host only). No outbound HTTP request is performed yet.
 */
@Component
public class WebhookJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(WebhookJobHandler.class);

    private final ObjectMapper objectMapper;

    public WebhookJobHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String queueName() {
        return QueueNames.WEBHOOK;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(300L, 120L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        WebhookJobPayload payload = objectMapper.convertValue(job.payload(), WebhookJobPayload.class);
        if (payload == null || !StringUtils.hasText(payload.url()) || !StringUtils.hasText(payload.eventType())) {
            throw new IllegalArgumentException("Invalid webhook job payload");
        }

        URI uri;
        try {
            uri = new URI(payload.url());
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Invalid webhook URL: " + e.getMessage());
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("Webhook URL must use HTTPS scheme");
        }

        String host = uri.getHost();
        if (!StringUtils.hasText(host)) {
            throw new IllegalArgumentException("Webhook URL must have a valid host");
        }

        if (payload.eventType().length() > 100) {
            throw new IllegalArgumentException("eventType exceeds max length of 100");
        }

        if (payload.correlationId() != null && payload.correlationId().length() > 200) {
            throw new IllegalArgumentException("correlationId exceeds max length of 200");
        }

        if (payload.body() != null && payload.body().length() > 100000) {
            throw new IllegalArgumentException("body exceeds max length of 100000");
        }

        // Log with sanitized destination (host only, no query params or credentials)
        log.info(
                "Webhook job accepted id={} event={} host={} correlation={}",
                job.id(),
                payload.eventType(),
                host,
                payload.correlationId()
        );
    }
}
