package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.podcast.entity.Format;
import java.util.Comparator;

public record FormatView(
        Long id,
        String slug,
        String name,
        Integer requiredLevelSortOrder,
        int sortOrder
) {

    /** Canonical ordering for format collections in API views: sortOrder, then id. */
    public static final Comparator<Format> DISPLAY_ORDER =
            Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId);

    public static FormatView of(Format format) {
        return new FormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }
}
