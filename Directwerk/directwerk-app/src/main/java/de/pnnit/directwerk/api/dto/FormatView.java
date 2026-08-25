package de.pnnit.directwerk.api.dto;

public record FormatView(
        Long id,
        String slug,
        String name,
        Integer requiredLevelSortOrder,
        int sortOrder
) {
}
