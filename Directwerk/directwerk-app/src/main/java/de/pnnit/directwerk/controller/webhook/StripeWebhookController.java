package de.pnnit.directwerk.controller.webhook;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.subscription.stripe.StripeOperations;
import de.pnnit.directwerk.modules.subscription.stripe.StripeWebhookService;
import de.pnnit.directwerk.modules.subscription.stripe.job.StripeWebhookJobProducer;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/webhooks")
public class StripeWebhookController {

    private final StripeWebhookService stripeWebhookService;
    private final StripeWebhookJobProducer stripeWebhookJobProducer;

    public StripeWebhookController(
            StripeWebhookService stripeWebhookService,
            StripeWebhookJobProducer stripeWebhookJobProducer
    ) {
        this.stripeWebhookService = stripeWebhookService;
        this.stripeWebhookJobProducer = stripeWebhookJobProducer;
    }

    @PostMapping(value = "/stripe", consumes = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Response<Void>> handle(
            @RequestHeader(value = "Stripe-Signature", required = false) String signature,
            @RequestBody String payload
    ) {
        StripeOperations.StripeWebhookPayload event = stripeWebhookService.parseAndValidate(payload, signature);
        stripeWebhookJobProducer.accept(event);
        return ResponseEntity.ok(Response.emptyOk());
    }
}
