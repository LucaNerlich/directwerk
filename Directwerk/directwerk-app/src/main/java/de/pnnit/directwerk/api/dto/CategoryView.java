package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.digital.entity.Category;
import java.util.Comparator;

public record CategoryView(
        Long id,
        String slug,
        String name,
        Long parentId
) {

    /** Canonical ordering for category collections in API views: name, then id. */
    public static final Comparator<Category> DISPLAY_ORDER =
            Comparator.comparing(Category::getName).thenComparing(Category::getId);

    public static CategoryView of(Category category) {
        return new CategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
    }
}
