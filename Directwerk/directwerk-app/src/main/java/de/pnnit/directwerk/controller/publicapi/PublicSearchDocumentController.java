package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.dto.PublicSearchDocumentView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.search.PublicSearchDocumentService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Header search feed. Host resolves the tenant; a session is optional.
 * Paid {@code plainText} is filled only when this caller's entitlements unlock that row.
 */
@RestController
@RequestMapping("/api/v1/public")
public class PublicSearchDocumentController {

    private final PublicSearchDocumentService publicSearchDocumentService;

    public PublicSearchDocumentController(PublicSearchDocumentService publicSearchDocumentService) {
        this.publicSearchDocumentService = publicSearchDocumentService;
    }

    @GetMapping("/search-documents")
    ResponseEntity<Response<List<PublicSearchDocumentView>>> listSearchDocuments() {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicSearchDocumentService.list(tenantId)));
    }
}
