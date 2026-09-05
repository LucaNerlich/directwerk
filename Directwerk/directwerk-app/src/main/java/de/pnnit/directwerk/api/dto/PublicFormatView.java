package de.pnnit.directwerk.api.dto;

public record PublicFormatView(
        Long id,
        String slug,
        String name,
        String description,
        Integer requiredLevelSortOrder,
        int sortOrder
) {
}
