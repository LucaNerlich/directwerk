package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
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
@RequiresModule(DigitalContentModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/categories")
public class TenantCategoryController {

    private final CategoryService categoryService;

    public TenantCategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    ResponseEntity<Response<List<CategoryView>>> listCategories() {
        Long tenantId = TenantContext.requireTenantId();
        List<CategoryView> categories = categoryService.listCategories(tenantId, false).stream()
                .map(TenantCategoryController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(categories));
    }

    @PostMapping
    ResponseEntity<Response<CategoryView>> createCategory(@Valid @RequestBody CreateCategoryRequest request) {
        Long tenantId = TenantContext.requireTenantId();
                Category category = categoryService.createCategory(
                tenantId,
                request.slug(),
                request.name(),
                request.parentId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(category)));
    }

    @PutMapping("/{categoryId}")
    ResponseEntity<Response<CategoryView>> updateCategory(
            @PathVariable Long categoryId,
            @Valid @RequestBody UpdateCategoryRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
                Category category = categoryService.updateCategory(
                tenantId,
                categoryId,
                request.slug(),
                request.name(),
                request.parentId(),
                request.active()
        );
        return ResponseEntity.ok(Response.ok(toView(category)));
    }

    @DeleteMapping("/{categoryId}")
    ResponseEntity<Response<CategoryView>> deactivateCategory(@PathVariable Long categoryId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(categoryService.deactivateCategory(tenantId, categoryId))));
    }

    static CategoryView toView(Category category) {
        return new CategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null,
                category.isActive(),
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }

    public record CreateCategoryRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String name,
            @Min(1) Long parentId
    ) {
    }

    public record UpdateCategoryRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String name,
            @Min(1) Long parentId,
            Boolean active
    ) {
    }

    public record CategoryView(
            Long id,
            String slug,
            String name,
            Long parentId,
            boolean active,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
