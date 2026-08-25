package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;
import java.util.Set;

public record ReplaceCategoriesRequest(Set<@Min(1) Long> categoryIds) {
}
