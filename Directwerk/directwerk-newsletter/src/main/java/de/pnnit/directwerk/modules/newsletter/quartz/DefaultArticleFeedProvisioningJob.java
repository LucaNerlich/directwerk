package de.pnnit.directwerk.modules.newsletter.quartz;

import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedProvisioningService;
import de.pnnit.directwerk.modules.queue.quartz.AbstractDefaultFeedProvisioningJob;
import org.quartz.DisallowConcurrentExecution;
import org.springframework.beans.factory.annotation.Autowired;

@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class DefaultArticleFeedProvisioningJob extends AbstractDefaultFeedProvisioningJob {

    private ArticleFeedProvisioningService articleFeedProvisioningService;

    @Autowired
    public void setArticleFeedProvisioningService(
            ArticleFeedProvisioningService articleFeedProvisioningService
    ) {
        this.articleFeedProvisioningService = articleFeedProvisioningService;
    }

    @Override
    protected int provisionMissingDefaultFeeds() {
        return articleFeedProvisioningService.provisionMissingDefaultFeeds();
    }

    @Override
    protected String jobLabel() {
        return "Default article feed provisioning";
    }
}
