package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.CategoryRepository;
import jakarta.persistence.EntityManager;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.LongConsumer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private static final int MAX_NAME_LENGTH = 255;
    private static final int CATEGORY_REPARENT_LOCK_NAMESPACE = 0x43415447; // "CATG"

    private final CategoryRepository categoryRepository;
    private final TenantRepository tenantRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<Category> listCategories(Long tenantId, boolean activeOnly) {
        if (activeOnly) {
            return categoryRepository.findByTenantIdAndActiveTrueOrderByNameAscIdAsc(tenantId);
        }
        return categoryRepository.findByTenantIdOrderByNameAscIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public Category requireCategory(Long tenantId, Long categoryId) {
        return categoryRepository.findByIdAndTenantId(categoryId, tenantId)
                .orElseThrow(() -> new CategoryNotFoundException(categoryId));
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Category createCategory(
            Long tenantId,
            String rawSlug,
            String name,
            Long parentId
    ) {
        String slug = SlugNormalizer.normalize(rawSlug);
        if (categoryRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.CATEGORY_SLUG_EXISTS, "Category slug already exists: " + slug);
        }

        Category category = new Category();
        category.setTenant(tenantRepository.getReferenceById(tenantId));
        category.setSlug(slug);
        category.setName(normalizeName(name));
        category.setParent(resolveParent(tenantId, parentId));
        category.setActive(true);
        return categoryRepository.save(category);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Category updateCategory(
            Long tenantId,
            Long categoryId,
            String rawSlug,
            String name,
            Long parentId,
            Boolean active
    ) {
        Category category = requireCategory(tenantId, categoryId);
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (categoryRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, categoryId)) {
                throw new ConflictException(ConflictCodes.CATEGORY_SLUG_EXISTS, "Category slug already exists: " + slug);
            }
            category.setSlug(slug);
        }
        if (name != null) {
            category.setName(normalizeName(name));
        }
        if (parentId != null) {
            if (parentId.equals(categoryId)) {
                throw new IllegalArgumentException("Category cannot be its own parent");
            }
            acquireTenantCategoryLock(tenantId);
            Category parent = resolveParent(tenantId, parentId);
            assertNoCycle(parent, categoryId);
            category.setParent(parent);
        }
        if (active != null) {
            category.setActive(active);
        }
        return categoryRepository.save(category);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Category deactivateCategory(Long tenantId, Long categoryId) {
        return updateCategory(tenantId, categoryId, null, null, null, false);
    }


    public Set<Category> resolveActiveCategories(
            Long tenantId,
            Set<Long> categoryIds,
            LongConsumer onInactive
    ) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            return Set.of();
        }
        Set<Category> categories = new LinkedHashSet<>();
        for (Long categoryId : categoryIds) {
            Category category = requireCategory(tenantId, categoryId);
            if (!category.isActive()) {
                onInactive.accept(categoryId);
            }
            categories.add(category);
        }
        return categories;
    }

    private Category resolveParent(Long tenantId, Long parentId) {
        if (parentId == null) {
            return null;
        }
        return requireCategory(tenantId, parentId);
    }

    // Serializes concurrent reparenting per tenant so two racing updates can't each pass the
    // in-memory cycle check against stale data and jointly commit a cycle.
    private void acquireTenantCategoryLock(Long tenantId) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?, ?)")
                .setParameter(1, CATEGORY_REPARENT_LOCK_NAMESPACE)
                .setParameter(2, tenantId.intValue())
                .getSingleResult();
    }

    private static void assertNoCycle(Category parent, Long categoryId) {
        Category current = parent;
        while (current != null) {
            if (current.getId().equals(categoryId)) {
                throw new IllegalArgumentException("Category parent assignment would create a cycle");
            }
            current = current.getParent();
        }
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Category name is required");
        }
        String normalized = name.trim();
        if (normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Category name must be at most 255 characters");
        }
        return normalized;
    }
}
