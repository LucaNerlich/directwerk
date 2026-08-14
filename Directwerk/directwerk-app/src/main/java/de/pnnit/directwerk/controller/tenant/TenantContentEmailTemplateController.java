package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.email.EmailNotifyModule;
import de.pnnit.directwerk.modules.email.content.TenantContentEmailTemplateService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(EmailNotifyModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/content-email-templates")
public class TenantContentEmailTemplateController {

    private final TenantContentEmailTemplateService tenantContentEmailTemplateService;

    public TenantContentEmailTemplateController(
            TenantContentEmailTemplateService tenantContentEmailTemplateService
    ) {
        this.tenantContentEmailTemplateService = tenantContentEmailTemplateService;
    }

    @GetMapping("/{contentType}")
    ResponseEntity<Response<TenantContentEmailTemplateService.TemplateView>> getTemplate(
            @PathVariable String contentType
    ) {
        Long tenantId = TenantContext.requireTenantId();
        ContentType type = parseContentType(contentType);
        return tenantContentEmailTemplateService.findTemplateView(tenantId, type)
                .map(view -> ResponseEntity.ok(Response.ok(view)))
                .orElseGet(() -> ResponseEntity.ok(Response.ok(null)));
    }

    @PutMapping("/{contentType}")
    ResponseEntity<Response<TenantContentEmailTemplateService.TemplateView>> upsertTemplate(
            @PathVariable String contentType,
            @Valid @RequestBody UpsertContentEmailTemplateRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        ContentType type = parseContentType(contentType);
        TenantContentEmailTemplateService.TemplateView view = tenantContentEmailTemplateService.upsertTemplate(
                tenantId,
                type,
                request.subjectTemplate(),
                request.bodyHtml()
        );
        return ResponseEntity.ok(Response.ok(view));
    }

    private static ContentType parseContentType(String raw) {
        try {
            return ContentType.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported content type: " + raw);
        }
    }

    public record UpsertContentEmailTemplateRequest(
            @NotBlank @Size(max = 512) String subjectTemplate,
            @NotBlank @Size(max = 65535) String bodyHtml
    ) {
    }
}
