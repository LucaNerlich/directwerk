package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.content.TenantMembershipActivatedEvent;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedProvisioningService;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SubscriberFeedProvisioningListener {

    private final SubscriberFeedProvisioningService subscriberFeedProvisioningService;

    public SubscriberFeedProvisioningListener(
            SubscriberFeedProvisioningService subscriberFeedProvisioningService
    ) {
        this.subscriberFeedProvisioningService = subscriberFeedProvisioningService;
    }

    @TransactionalEventListener
    public void onTenantMembershipActivated(TenantMembershipActivatedEvent event) {
        subscriberFeedProvisioningService.provisionDefaultFeed(event.tenantId(), event.userId());
    }

    @TransactionalEventListener
    public void onSubscriptionMembershipActivated(SubscriptionMembershipActivatedEvent event) {
        subscriberFeedProvisioningService.provisionDefaultFeed(event.tenantId(), event.userId());
    }
}
