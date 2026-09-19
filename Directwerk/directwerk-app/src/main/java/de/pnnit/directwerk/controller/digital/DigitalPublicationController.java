package de.pnnit.directwerk.controller.digital;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.BonusContentModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.service.DigitalPublicationService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(BonusContentModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/digital-publications")
public class DigitalPublicationController {

    private final DigitalPublicationService digitalPublicationService;

    public DigitalPublicationController(DigitalPublicationService digitalPublicationService) {
        this.digitalPublicationService = digitalPublicationService;
    }

    @GetMapping
    ResponseEntity<Response<List<DigitalPublicationView>>> list() {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(
                digitalPublicationService.list(tenantId).stream().map(DigitalPublicationController::toView).toList()
        ));
    }

    @GetMapping("/{publicationId}")
    ResponseEntity<Response<DigitalPublicationView>> get(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.require(tenantId, publicationId))));
    }

    @PostMapping
    ResponseEntity<Response<DigitalPublicationView>> create(@Valid @RequestBody CreateDigitalPublicationRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        DigitalPublication created = digitalPublicationService.createDraft(
                tenantId,
                request.slug(),
                request.title(),
                request.description(),
                request.assetId(),
                request.accessPolicy(),
                request.requiredLevelSortOrder()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(created)));
    }

    @PutMapping("/{publicationId}")
    ResponseEntity<Response<DigitalPublicationView>> update(
            @PathVariable Long publicationId,
            @Valid @RequestBody UpdateDigitalPublicationRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.updateDraft(
                tenantId,
                publicationId,
                request.slug(),
                request.title(),
                request.description(),
                request.assetId(),
                request.accessPolicy(),
                request.requiredLevelSortOrder()
        ))));
    }

    @PostMapping("/{publicationId}/publish")
    ResponseEntity<Response<DigitalPublicationView>> publish(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.publish(tenantId, publicationId))));
    }

    @PostMapping("/{publicationId}/unpublish")
    ResponseEntity<Response<DigitalPublicationView>> unpublish(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.unpublish(tenantId, publicationId))));
    }

    @PostMapping("/{publicationId}/archive")
    ResponseEntity<Response<DigitalPublicationView>> archive(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.archive(tenantId, publicationId))));
    }

    @PostMapping("/{publicationId}/unarchive")
    ResponseEntity<Response<DigitalPublicationView>> unarchive(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(digitalPublicationService.unarchive(tenantId, publicationId))));
    }

    @DeleteMapping("/{publicationId}")
    ResponseEntity<Void> delete(@PathVariable Long publicationId) {
        Long tenantId = TenantContext.requireTenantId();
        digitalPublicationService.delete(tenantId, publicationId);
        return ResponseEntity.noContent().build();
    }

    private static DigitalPublicationView toView(DigitalPublication publication) {
        return new DigitalPublicationView(
                publication.getId(),
                publication.getSlug(),
                publication.getTitle(),
                publication.getDescription(),
                publication.getAsset().getId(),
                publication.getAsset().getOriginalFilename(),
                publication.getAsset().getMimeType(),
                publication.getAsset().getSizeBytes(),
                publication.getAccessPolicy().name(),
                publication.getRequiredLevelSortOrder(),
                publication.getStatus().name(),
                publication.getPublishedAt(),
                publication.getCreatedBy(),
                publication.getCreatedAt(),
                publication.getUpdatedAt()
        );
    }

    public record CreateDigitalPublicationRequest(
            @NotBlank @Size(max = 64) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$") String slug,
            @NotBlank @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            @NotNull Long assetId,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder
    ) {
    }

    public record UpdateDigitalPublicationRequest(
            @Size(max = 64) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$") String slug,
            @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            Long assetId,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder
    ) {
    }

    public record DigitalPublicationView(
            Long id,
            String slug,
            String title,
            String description,
            Long assetId,
            String originalFilename,
            String mimeType,
            Long sizeBytes,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            String status,
            Instant publishedAt,
            Long createdBy,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
