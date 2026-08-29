package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.digital.entity.Category;

public record PublicCategoryView(
        Long id,
        String slug,
        String name,
        Long parentId
) {
    public static PublicCategoryView of(Category category) {
        return new PublicCategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
    }
}

