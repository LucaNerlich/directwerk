package de.pnnit.directwerk.modules.email.repository;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.email.entity.TenantContentEmailTemplate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantContentEmailTemplateRepository extends JpaRepository<TenantContentEmailTemplate, Long> {

    Optional<TenantContentEmailTemplate> findByTenantIdAndContentType(Long tenantId, ContentType contentType);
}
