package de.pnnit.directwerk.modules.stripebilling.job;

import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.stripebilling.StripeWebhookService;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class StripeWebhookJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final StripeWebhookService stripeWebhookService;

    public StripeWebhookJobHandler(ObjectMapper objectMapper, StripeWebhookService stripeWebhookService) {
        this.objectMapper = objectMapper;
        this.stripeWebhookService = stripeWebhookService;
    }

    @Override
    public String queueName() {
        return StripeWebhookQueueNames.STRIPE_WEBHOOK;
    }

    @Override
    public boolean requiresTenant() {
        return false;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(120L, 30L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        StripeWebhookJobPayload payload = objectMapper.convertValue(job.payload(), StripeWebhookJobPayload.class);
        if (payload == null || payload.eventId() == null || payload.eventId().isBlank()) {
            throw new IllegalArgumentException("Invalid Stripe webhook job payload");
        }
        stripeWebhookService.applyParsedEvent(payload.toStripeWebhookPayload());
    }
}
