package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.CategoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private EntityManager entityManager;

    private CategoryService service;

    @BeforeEach
    void setUp() {
        service = new CategoryService(categoryRepository, tenantRepository, entityManager);
        lenient().when(categoryRepository.save(any(Category.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createCategoryNormalizesSlugAndName() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenant);
        when(categoryRepository.existsByTenantIdAndSlug(10L, "politics")).thenReturn(false);

        Category created = service.createCategory(10L, " Politics ", "  Politics  ", null);

        assertThat(created.getSlug()).isEqualTo("politics");
        assertThat(created.getName()).isEqualTo("Politics");
        assertThat(created.getTenant()).isSameAs(tenant);
        assertThat(created.isActive()).isTrue();
        assertThat(created.getParent()).isNull();
    }

    @Test
    void createCategoryRejectsDuplicateSlug() {
        when(categoryRepository.existsByTenantIdAndSlug(10L, "politics")).thenReturn(true);

        assertThatThrownBy(() -> service.createCategory(10L, "politics", "Politics", null))
                .isInstanceOf(ConflictException.class);
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void createCategoryRejectsBlankName() {
        when(categoryRepository.existsByTenantIdAndSlug(10L, "politics")).thenReturn(false);

        assertThatThrownBy(() -> service.createCategory(10L, "politics", "   ", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateCategoryRejectsSelfAsParent() {
        Category category = categoryWithId(5L);
        when(categoryRepository.findByIdAndTenantId(5L, 10L)).thenReturn(java.util.Optional.of(category));

        assertThatThrownBy(() -> service.updateCategory(10L, 5L, null, null, 5L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("own parent");
    }

    @Test
    void updateCategoryRejectsParentCycle() {
        Category grandchild = categoryWithId(3L);
        Category child = categoryWithId(2L);
        Category root = categoryWithId(1L);
        child.setParent(root);
        // Proposed new parent for "root" (1L) is "grandchild" (3L), whose chain already runs
        // through root — assigning it would create a cycle.
        grandchild.setParent(child);

        when(categoryRepository.findByIdAndTenantId(1L, 10L)).thenReturn(java.util.Optional.of(root));
        when(categoryRepository.findByIdAndTenantId(3L, 10L)).thenReturn(java.util.Optional.of(grandchild));
        stubAdvisoryLock();

        assertThatThrownBy(() -> service.updateCategory(10L, 1L, null, null, 3L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cycle");
    }

    @Test
    void updateCategoryReparentsWhenNoCycle() {
        Category parent = categoryWithId(2L);
        Category category = categoryWithId(1L);

        when(categoryRepository.findByIdAndTenantId(1L, 10L)).thenReturn(java.util.Optional.of(category));
        when(categoryRepository.findByIdAndTenantId(2L, 10L)).thenReturn(java.util.Optional.of(parent));
        stubAdvisoryLock();

        Category updated = service.updateCategory(10L, 1L, null, null, 2L, null);

        assertThat(updated.getParent()).isSameAs(parent);
    }

    @Test
    void updateCategoryRejectsDuplicateSlugOnRename() {
        Category category = categoryWithId(1L);
        when(categoryRepository.findByIdAndTenantId(1L, 10L)).thenReturn(java.util.Optional.of(category));
        when(categoryRepository.existsByTenantIdAndSlugAndIdNot(10L, "updates", 1L)).thenReturn(true);

        assertThatThrownBy(() -> service.updateCategory(10L, 1L, "updates", null, null, null))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void deactivateCategoryClearsActiveFlag() {
        Category category = categoryWithId(1L);
        when(categoryRepository.findByIdAndTenantId(1L, 10L)).thenReturn(java.util.Optional.of(category));

        Category deactivated = service.deactivateCategory(10L, 1L);

        assertThat(deactivated.isActive()).isFalse();
    }

    @Test
    void requireCategoryThrowsWhenMissing() {
        when(categoryRepository.findByIdAndTenantId(99L, 10L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.requireCategory(10L, 99L))
                .isInstanceOf(CategoryNotFoundException.class);
    }

    @Test
    void resolveActiveCategoriesReturnsEmptySetForNoIds() {
        assertThat(service.resolveActiveCategories(10L, Set.of(), id -> { })).isEmpty();
        assertThat(service.resolveActiveCategories(10L, null, id -> { })).isEmpty();
    }

    @Test
    void resolveActiveCategoriesFlagsInactiveCategories() {
        Category inactive = categoryWithId(4L);
        inactive.setActive(false);
        when(categoryRepository.findByIdAndTenantId(4L, 10L)).thenReturn(java.util.Optional.of(inactive));

        java.util.List<Long> flagged = new java.util.ArrayList<>();
        Set<Category> resolved = service.resolveActiveCategories(10L, Set.of(4L), flagged::add);

        assertThat(resolved).containsExactly(inactive);
        assertThat(flagged).containsExactly(4L);
    }

    private void stubAdvisoryLock() {
        Query query = mock(Query.class);
        lenient().when(entityManager.createNativeQuery(any(String.class))).thenReturn(query);
        lenient().when(query.setParameter(anyInt(), any())).thenReturn(query);
        lenient().when(query.getSingleResult()).thenReturn(null);
    }

    private static Category categoryWithId(Long id) {
        Category category = new Category();
        category.setId(id);
        category.setSlug("slug-" + id);
        category.setName("Name " + id);
        category.setActive(true);
        return category;
    }
}
