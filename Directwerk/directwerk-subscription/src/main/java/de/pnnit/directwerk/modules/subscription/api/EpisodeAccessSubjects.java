package de.pnnit.directwerk.modules.subscription.api;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.Comparator;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Maps an already-loaded {@link Episode} onto the subscription module's entitlement subject.
 * Single home for that topology translation — both the per-episode and batch adapters share it.
 */
public final class EpisodeAccessSubjects {

    private EpisodeAccessSubjects() {
    }

    public static EntitlementService.EpisodeAccessSubject toSubject(Episode episode) {
        Set<Long> formatIds = episode.getFormats().stream()
                .map(Format::getId)
                .collect(Collectors.toUnmodifiableSet());
        Set<Long> categoryIds = episode.getCategories().stream()
                .map(category -> category.getId())
                .collect(Collectors.toUnmodifiableSet());
        Integer maxFormatRequiredLevel = episode.getFormats().stream()
                .map(Format::getRequiredLevelSortOrder)
                .filter(requiredLevel -> requiredLevel != null)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return new EntitlementService.EpisodeAccessSubject(
                episode.getAccessPolicy() == AccessPolicy.FREE,
                episode.getRequiredLevelSortOrder() != null ? episode.getRequiredLevelSortOrder() : 0,
                episode.getSeries().getId(),
                formatIds,
                categoryIds,
                maxFormatRequiredLevel
        );
    }
}
