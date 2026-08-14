package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.email.content.TenantContentEmailTemplateService;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class DelegatingEmailTemplateSource implements EmailTemplateSource {

    private final ClasspathEmailTemplateSource classpathEmailTemplateSource;
    private final TenantContentEmailTemplateService tenantContentEmailTemplateService;

    public DelegatingEmailTemplateSource(
            ClasspathEmailTemplateSource classpathEmailTemplateSource,
            TenantContentEmailTemplateService tenantContentEmailTemplateService
    ) {
        this.classpathEmailTemplateSource = classpathEmailTemplateSource;
        this.tenantContentEmailTemplateService = tenantContentEmailTemplateService;
    }

    @Override
    public String resolveBody(EmailTemplate template, Long tenantId) {
        if (tenantId != null && isTenantContentTemplate(template)) {
            return tenantContentEmailTemplateService.findTemplate(tenantId, toContentType(template))
                    .map(entity -> entity.getBodyHtml())
                    .orElseGet(() -> classpathEmailTemplateSource.resolveBody(template, tenantId));
        }
        return classpathEmailTemplateSource.resolveBody(template, tenantId);
    }

    @Override
    public String resolveSubject(EmailTemplate template, Long tenantId) {
        if (tenantId != null && isTenantContentTemplate(template)) {
            return tenantContentEmailTemplateService.findTemplate(tenantId, toContentType(template))
                    .map(entity -> entity.getSubjectTemplate())
                    .orElseGet(() -> classpathEmailTemplateSource.resolveSubject(template, tenantId));
        }
        return classpathEmailTemplateSource.resolveSubject(template, tenantId);
    }

    private static boolean isTenantContentTemplate(EmailTemplate template) {
        return template == EmailTemplate.CONTENT_EPISODE_PUBLISHED
                || template == EmailTemplate.CONTENT_ARTICLE_PUBLISHED;
    }

    private static ContentType toContentType(EmailTemplate template) {
        return template == EmailTemplate.CONTENT_EPISODE_PUBLISHED ? ContentType.EPISODE : ContentType.ARTICLE;
    }
}
