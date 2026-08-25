package de.pnnit.directwerk.api.dto;

public record CategoryView(
        Long id,
        String slug,
        String name,
        Long parentId
) {
}
