package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.entity.TenantApiKey;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService.IssuedApiKey;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.SecurityUtils;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/api-keys")
public class TenantApiKeyController {

    private final TenantApiKeyService tenantApiKeyService;

    public TenantApiKeyController(TenantApiKeyService tenantApiKeyService) {
        this.tenantApiKeyService = tenantApiKeyService;
    }

    @GetMapping
    ResponseEntity<Response<List<ApiKeyView>>> listApiKeys() {
        Long tenantId = TenantContext.requireTenantId();
        List<ApiKeyView> keys = tenantApiKeyService.listActive(tenantId).stream()
                .map(TenantApiKeyController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(keys));
    }

    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    ResponseEntity<Response<CreatedApiKeyView>> createApiKey(@Valid @RequestBody CreateApiKeyRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        Long userId = SecurityUtils.requireTenantPrincipal().userId();
        IssuedApiKey issued = tenantApiKeyService.create(
                tenantId,
                userId,
                request.name(),
                new LinkedHashSet<>(request.scopes())
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Response.created(toCreatedView(issued)));
    }

    @DeleteMapping("/{keyId}")
    ResponseEntity<Response<ApiKeyView>> revokeApiKey(@PathVariable Long keyId) {
        Long tenantId = TenantContext.requireTenantId();
        TenantApiKey key = tenantApiKeyService.revoke(tenantId, keyId);
        return ResponseEntity.ok(Response.ok(toView(key)));
    }

    private static ApiKeyView toView(TenantApiKey key) {
        return new ApiKeyView(
                key.getId(),
                key.getName(),
                key.getPrefix(),
                List.copyOf(key.getScopes()),
                key.getCreatedAt(),
                key.getLastUsedAt(),
                key.getExpiresAt(),
                key.getRevokedAt()
        );
    }

    private static CreatedApiKeyView toCreatedView(IssuedApiKey issued) {
        TenantApiKey key = issued.key();
        return new CreatedApiKeyView(
                key.getId(),
                key.getName(),
                key.getPrefix(),
                List.copyOf(key.getScopes()),
                key.getCreatedAt(),
                key.getLastUsedAt(),
                key.getExpiresAt(),
                key.getRevokedAt(),
                issued.rawSecret()
        );
    }

    public record CreateApiKeyRequest(
            @NotBlank @Size(max = 100) String name,
            @NotEmpty Set<@NotBlank @Size(max = 64) String> scopes
    ) {
    }

    public record ApiKeyView(
            Long id,
            String name,
            String prefix,
            List<String> scopes,
            Instant createdAt,
            Instant lastUsedAt,
            Instant expiresAt,
            Instant revokedAt
    ) {
    }

    /**
     * Create response includes {@code secret} exactly once. Clients must copy it; it is never
     * returned again.
     */
    public record CreatedApiKeyView(
            Long id,
            String name,
            String prefix,
            List<String> scopes,
            Instant createdAt,
            Instant lastUsedAt,
            Instant expiresAt,
            Instant revokedAt,
            String secret
    ) {
    }
}
