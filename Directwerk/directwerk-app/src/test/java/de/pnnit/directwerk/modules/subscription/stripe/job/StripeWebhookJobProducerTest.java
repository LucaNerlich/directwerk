package de.pnnit.directwerk.modules.subscription.stripe.job;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.modules.subscription.stripe.StripeOperations;
import de.pnnit.directwerk.modules.subscription.stripe.StripeWebhookService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class StripeWebhookJobProducerTest {

    @Mock
    private ObjectProvider<QueueService> queueServiceProvider;

    @Mock
    private QueueService queueService;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private StripeWebhookService stripeWebhookService;

    private StripeWebhookJobProducer producer;

    @BeforeEach
    void setUp() {
        producer = new StripeWebhookJobProducer(
                queueServiceProvider,
                new ObjectMapper(),
                directwerkConfig,
                stripeWebhookService
        );
    }

    @Test
    void appliesInlineWhenQueueDisabled() {
        StripeOperations.StripeWebhookPayload event = event();
        when(directwerkConfig.isQueueEnabled()).thenReturn(false);

        producer.accept(event);

        verify(stripeWebhookService).applyParsedEvent(event);
        verify(queueServiceProvider, never()).getObject();
    }

    @Test
    void enqueuesWhenQueueEnabled() {
        StripeOperations.StripeWebhookPayload event = event();
        when(directwerkConfig.isQueueEnabled()).thenReturn(true);
        when(queueServiceProvider.getObject()).thenReturn(queueService);

        producer.accept(event);

        verify(queueService).enqueue(
                eq(StripeWebhookQueueNames.STRIPE_WEBHOOK),
                any(ObjectNode.class),
                eq(0),
                eq(null),
                eq(null),
                eq(new JobEnqueueMetadata(null, null, null))
        );
        verify(stripeWebhookService, never()).applyParsedEvent(any());
    }

    private static StripeOperations.StripeWebhookPayload event() {
        return new StripeOperations.StripeWebhookPayload(
                "evt_1",
                "checkout.session.completed",
                "acct_1",
                "cus_1",
                "sub_1",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                "pi_1",
                false
        );
    }
}
