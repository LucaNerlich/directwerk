package de.pnnit.directwerk.api.dto;

public record PublicCategoryView(
        Long id,
        String slug,
        String name,
        Long parentId
) {
}
