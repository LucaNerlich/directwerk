package de.pnnit.directwerk.modules.stripebilling.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.StripeWebhookService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Accepts verified Stripe webhook events — enqueues when the queue is enabled, applies inline otherwise. */
@Service
public class StripeWebhookJobProducer {

    private final ObjectProvider<QueueService> queueService;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;
    private final StripeWebhookService stripeWebhookService;

    public StripeWebhookJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            StripeWebhookService stripeWebhookService
    ) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
        this.stripeWebhookService = stripeWebhookService;
    }

    public void accept(StripeOperations.StripeWebhookPayload event) {
        if (!directwerkConfig.isQueueEnabled()) {
            stripeWebhookService.applyParsedEvent(event);
            return;
        }
        queueService.getObject().enqueue(
                StripeWebhookQueueNames.STRIPE_WEBHOOK,
                objectMapper.valueToTree(StripeWebhookJobPayload.from(event)),
                0,
                null,
                null,
                new JobEnqueueMetadata(null, null, null)
        );
    }
}
