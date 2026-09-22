package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.NewsletterNotificationApi;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.repository.ContentNotificationMarkerRepository;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Component
public class ContentNotifyJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final ContentPublicUrlBuilder contentPublicUrlBuilder;
    private final TenantContentBrandingResolver tenantContentBrandingResolver;
    private final EmailJobProducer emailJobProducer;
    private final ObjectProvider<NewsletterNotificationApi> newsletterNotificationApi;
    private final ContentNotificationMarkerRepository contentNotificationMarkerRepository;
    private final DirectwerkConfig directwerkConfig;

    public ContentNotifyJobHandler(
            ObjectMapper objectMapper,
            TenantMembershipRepository tenantMembershipRepository,
            ContentPublicUrlBuilder contentPublicUrlBuilder,
            TenantContentBrandingResolver tenantContentBrandingResolver,
            @Lazy EmailJobProducer emailJobProducer,
            ObjectProvider<NewsletterNotificationApi> newsletterNotificationApi,
            ContentNotificationMarkerRepository contentNotificationMarkerRepository,
            DirectwerkConfig directwerkConfig
    ) {
        this.objectMapper = objectMapper;
        this.tenantMembershipRepository = tenantMembershipRepository;
        this.contentPublicUrlBuilder = contentPublicUrlBuilder;
        this.tenantContentBrandingResolver = tenantContentBrandingResolver;
        this.emailJobProducer = emailJobProducer;
        this.newsletterNotificationApi = newsletterNotificationApi;
        this.contentNotificationMarkerRepository = contentNotificationMarkerRepository;
        this.directwerkConfig = directwerkConfig;
    }

    @Override
    public String queueName() {
        return QueueNames.CONTENT_NOTIFY;
    }

    @Override
    @Transactional
    public void handle(QueueJob job) {
        ContentNotifyJobPayload payload = objectMapper.convertValue(job.payload(), ContentNotifyJobPayload.class);
        if (payload == null || !StringUtils.hasText(payload.contentType()) || payload.contentId() == null) {
            throw new IllegalArgumentException("Invalid content notify job payload");
        }

        ContentType contentType = ContentType.valueOf(payload.contentType());
        if (contentType == ContentType.ARTICLE) {
            notifyArticleLists(job.tenantId(), payload);
            return;
        }

        notifyEpisodeMembers(job.tenantId(), payload, contentType);
    }

    private void notifyArticleLists(Long tenantId, ContentNotifyJobPayload payload) {
        NewsletterNotificationApi api = newsletterNotificationApi.getIfAvailable();
        if (api == null) {
            return;
        }
        api.notifyArticlePublished(new ContentPublishedEvent(
                tenantId,
                ContentType.ARTICLE,
                payload.contentId(),
                payload.title(),
                payload.excerpt(),
                payload.slug(),
                payload.accessPolicy()
        ));
    }

    private void notifyEpisodeMembers(Long tenantId, ContentNotifyJobPayload payload, ContentType contentType) {
        if (!directwerkConfig.isEmailEnabled()) {
            return;
        }
        TenantContentBrandingResolver.BrandingContext branding = tenantContentBrandingResolver.resolve(tenantId);
        String contentUrl = contentPublicUrlBuilder.buildPublicContentUrl(tenantId, ContentType.EPISODE, payload.slug());
        String preferencesUrl = contentPublicUrlBuilder.buildNotificationPreferencesUrl(tenantId);
        List<TenantMembership> recipients = tenantMembershipRepository.findNotificationOptedInMembers(
                tenantId,
                MembershipStatus.ACTIVE
        );
        for (TenantMembership membership : recipients) {
            Long userId = membership.getUser().getId();
            // Claimed once per (content, recipient): a retry of this job skips subscribers who
            // were already notified instead of enqueueing a fresh email job for them.
            if (!contentNotificationMarkerRepository.claim(
                    tenantId, contentType.name(), payload.contentId(), userId)) {
                continue;
            }
            Map<String, String> variables = episodeVariables(payload, branding, contentUrl, preferencesUrl, membership);
            String correlationId = "content-notify-episode-%d-user-%d".formatted(
                    payload.contentId(),
                    userId
            );
            emailJobProducer.enqueueContentNotification(
                    tenantId,
                    membership.getUser().getEmail(),
                    EmailTemplate.CONTENT_EPISODE_PUBLISHED,
                    variables,
                    correlationId
            );
        }
    }

    private static Map<String, String> episodeVariables(
            ContentNotifyJobPayload payload,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl,
            String preferencesUrl,
            TenantMembership membership
    ) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", defaultName(membership.getUser().getName()));
        variables.put("tenantName", branding.tenantName());
        variables.put("siteTitle", branding.siteTitle());
        variables.put("title", payload.title());
        variables.put("excerpt", payload.excerpt() == null ? "" : payload.excerpt());
        variables.put("contentUrl", contentUrl);
        variables.put("preferencesUrl", preferencesUrl);
        variables.put("primaryColor", branding.primaryColor());
        return variables;
    }

    private static String defaultName(String name) {
        return StringUtils.hasText(name) ? name : "there";
    }
}
