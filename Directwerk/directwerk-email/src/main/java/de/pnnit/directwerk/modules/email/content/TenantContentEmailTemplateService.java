package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.email.entity.TenantContentEmailTemplate;
import de.pnnit.directwerk.modules.email.repository.TenantContentEmailTemplateRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantContentEmailTemplateService {

    private final TenantContentEmailTemplateRepository tenantContentEmailTemplateRepository;
    private final TenantRepository tenantRepository;

    @Transactional(readOnly = true)
    public Optional<TenantContentEmailTemplate> findTemplate(Long tenantId, ContentType contentType) {
        return tenantContentEmailTemplateRepository.findByTenantIdAndContentType(tenantId, contentType);
    }

    @Transactional(readOnly = true)
    public Optional<TemplateView> findTemplateView(Long tenantId, ContentType contentType) {
        return findTemplate(tenantId, contentType).map(TenantContentEmailTemplateService::toView);
    }

    @Transactional
    public TemplateView upsertTemplate(
            Long tenantId,
            ContentType contentType,
            String subjectTemplate,
            String bodyHtml
    ) {
        Tenant tenant = tenantRepository.getReferenceById(tenantId);
        TenantContentEmailTemplate template = tenantContentEmailTemplateRepository
                .findByTenantIdAndContentType(tenant.getId(), contentType)
                .orElseGet(() -> {
                    TenantContentEmailTemplate created = new TenantContentEmailTemplate();
                    created.setTenant(tenant);
                    created.setContentType(contentType);
                    return created;
                });
        template.setSubjectTemplate(subjectTemplate);
        template.setBodyHtml(bodyHtml);
        return toView(tenantContentEmailTemplateRepository.save(template));
    }

    public static TemplateView toView(TenantContentEmailTemplate template) {
        return new TemplateView(
                template.getContentType().name(),
                template.getSubjectTemplate(),
                template.getBodyHtml(),
                template.getUpdatedAt()
        );
    }

    public record TemplateView(
            String contentType,
            String subjectTemplate,
            String bodyHtml,
            java.time.Instant updatedAt
    ) {
    }
}
