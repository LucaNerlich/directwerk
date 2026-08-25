package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.stripe.StripeMembershipActivatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class StripeMembershipActivatedListener {

    private final SubscriberFeedService subscriberFeedService;

    public StripeMembershipActivatedListener(SubscriberFeedService subscriberFeedService) {
        this.subscriberFeedService = subscriberFeedService;
    }

    @TransactionalEventListener
    public void onActivated(StripeMembershipActivatedEvent event) {
        subscriberFeedService.ensureDefaultFeed(event.tenantId(), event.userId());
    }
}
