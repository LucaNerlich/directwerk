package de.pnnit.directwerk.api.dto;

import java.util.List;

/**
 * Bulk delete result. The call is atomic, so on success every echoed id was
 * deleted; on any failure nothing was deleted and an error envelope is
 * returned instead.
 */
public record BulkDeleteView(List<Long> deletedIds) {
}
