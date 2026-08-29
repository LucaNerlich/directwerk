package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.service.FormatService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
@RequiresModule(PodcastModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/formats")
public class TenantFormatController {

    private final FormatService formatService;

    public TenantFormatController(FormatService formatService) {
        this.formatService = formatService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
    ResponseEntity<Response<List<FormatView>>> listFormats() {
        Long tenantId = TenantContext.requireTenantId();
        List<FormatView> formats = formatService.listFormats(tenantId, false).stream()
                .map(TenantFormatController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(formats));
    }

    @PostMapping
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<FormatView>> createFormat(@Valid @RequestBody CreateFormatRequest request) {
        Long tenantId = TenantContext.requireTenantId();
                Format format = formatService.createFormat(
                tenantId,
                request.slug(),
                request.name(),
                request.description(),
                request.requiredLevelSortOrder(),
                request.sortOrder(),
                request.coverAssetId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(format)));
    }

    @PutMapping("/{formatId}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<FormatView>> updateFormat(
            @PathVariable Long formatId,
            @Valid @RequestBody UpdateFormatRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
                Format format = formatService.updateFormat(
                tenantId,
                formatId,
                request.slug(),
                request.name(),
                request.description(),
                request.requiredLevelSortOrder(),
                request.sortOrder(),
                request.active(),
                request.coverAssetId()
        );
        return ResponseEntity.ok(Response.ok(toView(format)));
    }

    @DeleteMapping("/{formatId}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<FormatView>> deactivateFormat(@PathVariable Long formatId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(formatService.deactivateFormat(tenantId, formatId))));
    }

    static FormatView toView(Format format) {
        return new FormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getDescription(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder(),
                format.isActive(),
                format.getCoverAsset() != null ? format.getCoverAsset().getId() : null,
                format.getCreatedAt(),
                format.getUpdatedAt()
        );
    }

    public record CreateFormatRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String name,
            String description,
            @Min(0) Integer requiredLevelSortOrder,
            @Min(0) Integer sortOrder,
            @Min(1) Long coverAssetId
    ) {
    }

    public record UpdateFormatRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String name,
            String description,
            @Min(0) Integer requiredLevelSortOrder,
            @Min(0) Integer sortOrder,
            Boolean active,
            @Min(1) Long coverAssetId
    ) {
    }

    public record FormatView(
            Long id,
            String slug,
            String name,
            String description,
            Integer requiredLevelSortOrder,
            int sortOrder,
            boolean active,
            Long coverAssetId,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
