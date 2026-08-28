package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedProvisioningService;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SubscriptionMembershipActivatedListener {

    private final SubscriberFeedProvisioningService subscriberFeedProvisioningService;

    public SubscriptionMembershipActivatedListener(
            SubscriberFeedProvisioningService subscriberFeedProvisioningService
    ) {
        this.subscriberFeedProvisioningService = subscriberFeedProvisioningService;
    }

    @TransactionalEventListener
    public void onMembershipActivated(SubscriptionMembershipActivatedEvent event) {
        subscriberFeedProvisioningService.provisionOnMembershipActivated(event.tenantId(), event.userId());
    }
}
