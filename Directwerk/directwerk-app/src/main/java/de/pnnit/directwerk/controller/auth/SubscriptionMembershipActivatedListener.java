package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import de.pnnit.directwerk.modules.subscription.stripe.StripeMembershipActivatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SubscriptionMembershipActivatedListener {

    private final SubscriberFeedService subscriberFeedService;

    public SubscriptionMembershipActivatedListener(SubscriberFeedService subscriberFeedService) {
        this.subscriberFeedService = subscriberFeedService;
    }

    @TransactionalEventListener
    public void onMembershipActivated(SubscriptionMembershipActivatedEvent event) {
        subscriberFeedService.ensureDefaultFeed(event.tenantId(), event.userId());
    }

    @TransactionalEventListener
    public void onStripeMembershipActivated(StripeMembershipActivatedEvent event) {
        subscriberFeedService.ensureDefaultFeed(event.tenantId(), event.userId());
    }
}
