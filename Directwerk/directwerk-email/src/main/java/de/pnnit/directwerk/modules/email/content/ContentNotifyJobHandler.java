package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Component
public class ContentNotifyJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final ContentPublicUrlBuilder contentPublicUrlBuilder;
    private final TenantContentBrandingResolver tenantContentBrandingResolver;
    private final EmailJobProducer emailJobProducer;

    public ContentNotifyJobHandler(
            ObjectMapper objectMapper,
            TenantMembershipRepository tenantMembershipRepository,
            ContentPublicUrlBuilder contentPublicUrlBuilder,
            TenantContentBrandingResolver tenantContentBrandingResolver,
            @Lazy EmailJobProducer emailJobProducer
    ) {
        this.objectMapper = objectMapper;
        this.tenantMembershipRepository = tenantMembershipRepository;
        this.contentPublicUrlBuilder = contentPublicUrlBuilder;
        this.tenantContentBrandingResolver = tenantContentBrandingResolver;
        this.emailJobProducer = emailJobProducer;
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
        EmailTemplate template = contentType == ContentType.EPISODE
                ? EmailTemplate.CONTENT_EPISODE_PUBLISHED
                : EmailTemplate.CONTENT_ARTICLE_PUBLISHED;

        Long tenantId = job.tenantId();
        TenantContentBrandingResolver.BrandingContext branding = tenantContentBrandingResolver.resolve(tenantId);
        String contentUrl = contentPublicUrlBuilder.buildPublicContentUrl(
                tenantId,
                contentType,
                payload.slug()
        );
        String preferencesUrl = contentPublicUrlBuilder.buildNotificationPreferencesUrl(tenantId);

        List<TenantMembership> recipients = tenantMembershipRepository.findNotificationOptedInMembers(
                tenantId,
                MembershipStatus.ACTIVE
        );
        for (TenantMembership membership : recipients) {
            Map<String, String> variables = buildVariables(payload, branding, contentUrl, preferencesUrl, membership);
            String correlationId = "content-notify-%s-%d-user-%d".formatted(
                    contentType.name().toLowerCase(Locale.ROOT),
                    payload.contentId(),
                    membership.getUser().getId()
            );
            emailJobProducer.enqueueContentNotification(tenantId, membership.getUser().getEmail(), template, variables, correlationId);
        }
    }

    private static Map<String, String> buildVariables(
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
