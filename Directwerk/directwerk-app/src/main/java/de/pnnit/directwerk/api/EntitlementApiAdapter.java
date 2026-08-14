package de.pnnit.directwerk.api;

import de.pnnit.directwerk.modules.digital.api.EntitlementApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.Comparator;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
@RequiredArgsConstructor
public class EntitlementApiAdapter implements EntitlementApi {

    private final EpisodeRepository episodeRepository;
    private final EntitlementService entitlementService;

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return episodeRepository.findByIdAndTenantId(episodeId, tenantId)
                .filter(episode -> episode.getStatus() == EpisodeStatus.PUBLISHED)
                .map(episode -> entitlementService.hasEpisodeAccess(tenantId, userId, toSubject(episode)))
                .orElse(false);
    }

    @Override
    public boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId) {
        return entitlementService.hasDigitalAssetAccess(tenantId, userId, mediaAssetId);
    }

    private static EntitlementService.EpisodeAccessSubject toSubject(Episode episode) {
        Set<Long> formatIds = episode.getFormats().stream()
                .map(Format::getId)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        Set<Long> categoryIds = episode.getCategories().stream()
                .map(category -> category.getId())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
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
