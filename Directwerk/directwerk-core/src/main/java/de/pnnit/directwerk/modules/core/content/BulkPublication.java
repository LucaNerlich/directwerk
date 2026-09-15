package de.pnnit.directwerk.modules.core.content;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.function.Function;

/**
 * The one batch rule for bulk publish/unpublish/delete: request order, duplicates
 * removed, one operation per id. Keeps the per-kind services to their actual work
 * instead of re-spelling the loop.
 */
public final class BulkPublication {

    private BulkPublication() {
    }

    /** Distinct ids in request order. */
    public static List<Long> distinctIds(Collection<Long> ids) {
        return new ArrayList<>(new LinkedHashSet<>(ids));
    }

    /** Applies {@code operation} to each distinct id, in request order. */
    public static <T> List<T> apply(Collection<Long> ids, Function<Long, T> operation) {
        List<T> results = new ArrayList<>();
        for (Long id : distinctIds(ids)) {
            results.add(operation.apply(id));
        }
        return results;
    }
}
