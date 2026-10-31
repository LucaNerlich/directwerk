package de.pnnit.directwerk.modules.core.util;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * {@link Pageable} that treats {@code offset} as rows to skip (LIMIT/OFFSET), not as
 * {@code pageIndex * pageSize}. Spring's {@code PageRequest.of(offset/limit, limit)} floors
 * non-multiples and skips the wrong rows.
 */
public final class OffsetLimitPageRequest implements Pageable {

    private final int limit;
    private final int offset;
    private final Sort sort;

    private OffsetLimitPageRequest(int limit, int offset, Sort sort) {
        this.limit = limit;
        this.offset = offset;
        this.sort = sort == null ? Sort.unsorted() : sort;
    }

    /** Uncapped limit (callers clamp before calling when needed). */
    public static OffsetLimitPageRequest of(int limit, int offset) {
        return new OffsetLimitPageRequest(Math.max(limit, 1), Math.max(offset, 0), Sort.unsorted());
    }

    /** Limit clamped to {@code [1, maxLimit]}. */
    public static OffsetLimitPageRequest of(int limit, int offset, int maxLimit) {
        int pageSize = Math.min(Math.max(limit, 1), Math.max(maxLimit, 1));
        return new OffsetLimitPageRequest(pageSize, Math.max(offset, 0), Sort.unsorted());
    }

    @Override
    public int getPageNumber() {
        return offset / limit;
    }

    @Override
    public int getPageSize() {
        return limit;
    }

    @Override
    public long getOffset() {
        return offset;
    }

    @Override
    public Sort getSort() {
        return sort;
    }

    @Override
    public Pageable next() {
        return new OffsetLimitPageRequest(limit, offset + limit, sort);
    }

    @Override
    public Pageable previousOrFirst() {
        return hasPrevious() ? new OffsetLimitPageRequest(limit, Math.max(offset - limit, 0), sort) : first();
    }

    @Override
    public Pageable first() {
        return new OffsetLimitPageRequest(limit, 0, sort);
    }

    @Override
    public Pageable withPage(int pageNumber) {
        if (pageNumber < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        return new OffsetLimitPageRequest(limit, pageNumber * limit, sort);
    }

    @Override
    public boolean hasPrevious() {
        return offset > 0;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof OffsetLimitPageRequest that)) {
            return false;
        }
        return limit == that.limit && offset == that.offset && sort.equals(that.sort);
    }

    @Override
    public int hashCode() {
        int result = Integer.hashCode(limit);
        result = 31 * result + Integer.hashCode(offset);
        result = 31 * result + sort.hashCode();
        return result;
    }

    @Override
    public String toString() {
        return "OffsetLimitPageRequest[offset=%d, limit=%d, sort=%s]".formatted(offset, limit, sort);
    }
}
