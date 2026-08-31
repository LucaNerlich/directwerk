package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.content.TenantMembershipActivatedEvent;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedProvisioningService;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ArticleFeedProvisioningListener {

    private final ArticleFeedProvisioningService articleFeedProvisioningService;

    public ArticleFeedProvisioningListener(
            ArticleFeedProvisioningService articleFeedProvisioningService
    ) {
        this.articleFeedProvisioningService = articleFeedProvisioningService;
    }

    @TransactionalEventListener
    public void onTenantMembershipActivated(TenantMembershipActivatedEvent event) {
        articleFeedProvisioningService.provisionDefaultFeed(event.tenantId(), event.userId());
    }

    @TransactionalEventListener
    public void onSubscriptionMembershipActivated(SubscriptionMembershipActivatedEvent event) {
        articleFeedProvisioningService.provisionDefaultFeed(event.tenantId(), event.userId());
    }
}
