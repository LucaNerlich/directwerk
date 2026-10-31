package de.pnnit.directwerk.subscription;

import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessSubjects;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessSubjects;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.AccessExplanation;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.AccessSummary;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.ArticleAccessSubject;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.EpisodeAccessSubject;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.LevelEntitlement;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.MatchedPackageRule;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.PackageEntitlement;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tenant-admin read model: entitlement summary + optional episode/article access explanation.
 */
@Service
@RequiredArgsConstructor
public class SubscriberEntitlementExplainService {

    private final TenantMembershipRepository tenantMembershipRepository;
    private final EntitlementService entitlementService;
    private final EpisodeRepository episodeRepository;
    private final ArticleRepository articleRepository;

    /**
     * @return empty when the user is not a member of the tenant
     */
    @Transactional(readOnly = true)
    public Optional<SubscriberAccessExplainView> explain(
            Long tenantId,
            Long userId,
            Long episodeId,
            Long articleId
    ) {
        if (tenantMembershipRepository.findByTenantIdAndUserId(tenantId, userId).isEmpty()) {
            return Optional.empty();
        }

        AccessSummary access = entitlementService.resolveAccess(tenantId, userId);
        ContentCheckView check = null;
        if (episodeId != null) {
            check = explainEpisode(tenantId, userId, episodeId);
        } else if (articleId != null) {
            check = explainArticle(tenantId, userId, articleId);
        }

        return Optional.of(new SubscriberAccessExplainView(
                userId,
                access.activeLevels(),
                access.maxLevelSortOrder(),
                access.activePackages(),
                check
        ));
    }

    private ContentCheckView explainEpisode(Long tenantId, Long userId, Long episodeId) {
        Episode episode = episodeRepository.findByIdAndTenantId(episodeId, tenantId).orElse(null);
        if (episode == null) {
            return ContentCheckView.notFound("EPISODE", episodeId);
        }
        EpisodeAccessSubject subject = EpisodeAccessSubjects.toSubject(episode);
        SubjectSnapshotView snapshot = SubjectSnapshotView.fromEpisode(subject);
        if (episode.getStatus() != EpisodeStatus.PUBLISHED) {
            return new ContentCheckView(
                    "EPISODE",
                    episodeId,
                    episode.getTitle(),
                    episode.getSlug(),
                    false,
                    "NOT_PUBLISHED",
                    snapshot,
                    List.of()
            );
        }
        AccessExplanation explanation = entitlementService.explainAccess(tenantId, userId, subject);
        return ContentCheckView.fromExplanation(
                "EPISODE",
                episodeId,
                episode.getTitle(),
                episode.getSlug(),
                snapshot,
                explanation
        );
    }

    private ContentCheckView explainArticle(Long tenantId, Long userId, Long articleId) {
        Article article = articleRepository.findByIdAndTenantId(articleId, tenantId).orElse(null);
        if (article == null) {
            return ContentCheckView.notFound("ARTICLE", articleId);
        }
        ArticleAccessSubject subject = ArticleAccessSubjects.toSubject(article);
        SubjectSnapshotView snapshot = SubjectSnapshotView.fromArticle(subject);
        if (article.getStatus() != ArticleStatus.PUBLISHED) {
            return new ContentCheckView(
                    "ARTICLE",
                    articleId,
                    article.getTitle(),
                    article.getSlug(),
                    false,
                    "NOT_PUBLISHED",
                    snapshot,
                    List.of()
            );
        }
        AccessExplanation explanation = entitlementService.explainAccess(tenantId, userId, subject);
        return ContentCheckView.fromExplanation(
                "ARTICLE",
                articleId,
                article.getTitle(),
                article.getSlug(),
                snapshot,
                explanation
        );
    }

    public record SubscriberAccessExplainView(
            Long userId,
            List<LevelEntitlement> activeLevels,
            Integer maxLevelSortOrder,
            List<PackageEntitlement> activePackages,
            ContentCheckView check
    ) {
    }

    public record ContentCheckView(
            String kind,
            Long id,
            String title,
            String slug,
            boolean allowed,
            String reason,
            SubjectSnapshotView subject,
            List<MatchedRuleView> matchedRules
    ) {
        static ContentCheckView notFound(String kind, Long id) {
            return new ContentCheckView(
                    kind,
                    id,
                    null,
                    null,
                    false,
                    "CONTENT_NOT_FOUND",
                    null,
                    List.of()
            );
        }

        static ContentCheckView fromExplanation(
                String kind,
                Long id,
                String title,
                String slug,
                SubjectSnapshotView subject,
                AccessExplanation explanation
        ) {
            return new ContentCheckView(
                    kind,
                    id,
                    title,
                    slug,
                    explanation.allowed(),
                    explanation.reason().name(),
                    subject,
                    explanation.matchedRules().stream().map(MatchedRuleView::from).toList()
            );
        }
    }

    public record SubjectSnapshotView(
            boolean free,
            int requiredLevelSortOrder,
            Integer maxFormatRequiredLevel,
            Long seriesId,
            Set<Long> formatIds,
            Set<Long> categoryIds
    ) {
        static SubjectSnapshotView fromEpisode(EpisodeAccessSubject subject) {
            return new SubjectSnapshotView(
                    subject.free(),
                    subject.requiredLevelSortOrder(),
                    subject.maxFormatRequiredLevel(),
                    subject.seriesId(),
                    subject.formatIds(),
                    subject.categoryIds()
            );
        }

        static SubjectSnapshotView fromArticle(ArticleAccessSubject subject) {
            return new SubjectSnapshotView(
                    subject.free(),
                    subject.requiredLevelSortOrder(),
                    null,
                    null,
                    Set.of(),
                    subject.categoryIds()
            );
        }
    }

    public record MatchedRuleView(
            Long ruleId,
            Long productId,
            String productSlug,
            String productTitle,
            String scopeType,
            Long scopeId
    ) {
        static MatchedRuleView from(MatchedPackageRule rule) {
            return new MatchedRuleView(
                    rule.ruleId(),
                    rule.productId(),
                    rule.productSlug(),
                    rule.productTitle(),
                    rule.scopeType(),
                    rule.scopeId()
            );
        }
    }
}
