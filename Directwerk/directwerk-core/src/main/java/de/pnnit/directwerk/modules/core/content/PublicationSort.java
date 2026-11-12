package de.pnnit.directwerk.modules.core.content;

import org.springframework.data.domain.Sort;

/**
 * Studio list ordering shared by episode and article endpoints. {@link #CREATED} is the
 * historical order, so an omitted query parameter behaves exactly as before.
 */
public enum PublicationSort {
    CREATED(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))),
    PUBLISHED(Sort.by(Sort.Order.desc("publishedAt").nullsLast(), Sort.Order.desc("id"))),
    UPDATED(Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))),
    TITLE(Sort.by(Sort.Order.asc("title").ignoreCase(), Sort.Order.asc("id")));

    private final Sort sort;

    PublicationSort(Sort sort) {
        this.sort = sort;
    }

    /** Id tiebreaker keeps OFFSET paging deterministic. */
    public Sort toSort() {
        return sort;
    }
}
