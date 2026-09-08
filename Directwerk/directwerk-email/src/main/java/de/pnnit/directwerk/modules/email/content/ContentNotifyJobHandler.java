package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.NewsletterNotifyAudienceApi;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Component
public class ContentNotifyJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final ContentPublicUrlBuilder contentPublicUrlBuilder;
    private final PublicContentUrlResolver publicContentUrlResolver;
    private final TenantContentBrandingResolver tenantContentBrandingResolver;
    private final EmailJobProducer emailJobProducer;
    private final ObjectProvider<NewsletterNotifyAudienceApi> newsletterNotifyAudienceApi;

    public ContentNotifyJobHandler(
            ObjectMapper objectMapper,
            TenantMembershipRepository tenantMembershipRepository,
            ContentPublicUrlBuilder contentPublicUrlBuilder,
            PublicContentUrlResolver publicContentUrlResolver,
            TenantContentBrandingResolver tenantContentBrandingResolver,
            @Lazy EmailJobProducer emailJobProducer,
            ObjectProvider<NewsletterNotifyAudienceApi> newsletterNotifyAudienceApi
    ) {
        this.objectMapper = objectMapper;
        this.tenantMembershipRepository = tenantMembershipRepository;
        this.contentPublicUrlBuilder = contentPublicUrlBuilder;
        this.publicContentUrlResolver = publicContentUrlResolver;
        this.tenantContentBrandingResolver = tenantContentBrandingResolver;
        this.emailJobProducer = emailJobProducer;
        this.newsletterNotifyAudienceApi = newsletterNotifyAudienceApi;
    }

    @Override
    public String queueName() {
        return QueueNames.CONTENT_NOTIFY;
    }

    @Override
    public void handle(QueueJob job) {
        ContentNotifyJobPayload payload = objectMapper.convertValue(job.payload(), ContentNotifyJobPayload.class);
        if (payload == null || !StringUtils.hasText(payload.contentType()) || payload.contentId() == null) {
            throw new IllegalArgumentException("Invalid content notify job payload");
        }

        ContentType contentType = ContentType.valueOf(payload.contentType());
        Long tenantId = job.tenantId();
        TenantContentBrandingResolver.BrandingContext branding = tenantContentBrandingResolver.resolve(tenantId);
        String contentUrl = contentPublicUrlBuilder.buildPublicContentUrl(tenantId, contentType, payload.slug());

        if (contentType == ContentType.ARTICLE) {
            notifyArticleLists(tenantId, payload, branding, contentUrl);
            return;
        }

        notifyEpisodeMembers(tenantId, payload, branding, contentUrl);
    }

    private void notifyArticleLists(
            Long tenantId,
            ContentNotifyJobPayload payload,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl
    ) {
        NewsletterNotifyAudienceApi audienceApi = newsletterNotifyAudienceApi.getIfAvailable();
        if (audienceApi == null) {
            return;
        }
        List<NewsletterNotifyAudienceApi.Recipient> recipients =
                audienceApi.findActiveRecipientsForArticle(tenantId, payload.contentId());
        for (NewsletterNotifyAudienceApi.Recipient recipient : recipients) {
            String unsubscribeUrl = publicContentUrlResolver.newsletterUnsubscribeUrl(
                    tenantId,
                    recipient.rawUnsubscribeToken()
            );
            Map<String, String> variables = articleVariables(payload, branding, contentUrl, unsubscribeUrl);
            String correlationId = "content-notify-article-%d-email-%s".formatted(
                    payload.contentId(),
                    Integer.toHexString(recipient.email().toLowerCase(Locale.ROOT).hashCode())
            );
            emailJobProducer.enqueueContentNotification(
                    tenantId,
                    recipient.email(),
                    EmailTemplate.CONTENT_ARTICLE_PUBLISHED,
                    variables,
                    correlationId
            );
        }
    }

    private void notifyEpisodeMembers(
            Long tenantId,
            ContentNotifyJobPayload payload,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl
    ) {
        String preferencesUrl = contentPublicUrlBuilder.buildNotificationPreferencesUrl(tenantId);
        List<TenantMembership> recipients = tenantMembershipRepository.findNotificationOptedInMembers(
                tenantId,
                MembershipStatus.ACTIVE
        );
        for (TenantMembership membership : recipients) {
            Map<String, String> variables = episodeVariables(payload, branding, contentUrl, preferencesUrl, membership);
            String correlationId = "content-notify-episode-%d-user-%d".formatted(
                    payload.contentId(),
                    membership.getUser().getId()
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

    private static Map<String, String> articleVariables(
            ContentNotifyJobPayload payload,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl,
            String unsubscribeUrl
    ) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", "there");
        variables.put("tenantName", branding.tenantName());
        variables.put("siteTitle", branding.siteTitle());
        variables.put("title", payload.title());
        variables.put("excerpt", payload.excerpt() == null ? "" : payload.excerpt());
        variables.put("contentUrl", contentUrl);
        variables.put("unsubscribeUrl", unsubscribeUrl);
        variables.put("primaryColor", branding.primaryColor());
        return variables;
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
