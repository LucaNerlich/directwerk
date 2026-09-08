package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus;
import de.pnnit.directwerk.modules.newsletter.exception.NewsletterListNotFoundException;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterListRepository;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NewsletterListService {

    private static final int MAX_NAME_LENGTH = 255;
    private static final int MAX_DESCRIPTION_LENGTH = 4000;

    private final NewsletterListRepository newsletterListRepository;
    private final NewsletterSubscriptionRepository newsletterSubscriptionRepository;
    private final TenantRepository tenantRepository;

    @Transactional(readOnly = true)
    public List<NewsletterList> listLists(Long tenantId, boolean activeOnly) {
        if (activeOnly) {
            return newsletterListRepository.findByTenantIdAndStatusOrderByNameAscIdAsc(
                    tenantId,
                    NewsletterListStatus.ACTIVE
            );
        }
        return newsletterListRepository.findByTenantIdOrderByNameAscIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public NewsletterList requireList(Long tenantId, Long listId) {
        return newsletterListRepository.findByIdAndTenantId(listId, tenantId)
                .orElseThrow(() -> new NewsletterListNotFoundException(listId));
    }

    @Transactional(readOnly = true)
    public NewsletterList requireListBySlug(Long tenantId, String slug) {
        String normalized = SlugNormalizer.normalize(slug);
        return newsletterListRepository.findByTenantIdAndSlug(tenantId, normalized)
                .orElseThrow(() -> new NewsletterListNotFoundException(normalized));
    }

    @Transactional(readOnly = true)
    public NewsletterList requireActiveListBySlug(Long tenantId, String slug) {
        NewsletterList list = requireListBySlug(tenantId, slug);
        if (list.getStatus() != NewsletterListStatus.ACTIVE) {
            throw new NewsletterListNotFoundException(list.getSlug());
        }
        return list;
    }

    @Transactional(readOnly = true)
    public long countActiveSubscriptions(Long listId) {
        return newsletterSubscriptionRepository.countByListIdAndStatus(listId, NewsletterSubscriptionStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public long countPendingSubscriptions(Long listId) {
        return newsletterSubscriptionRepository.countByListIdAndStatus(listId, NewsletterSubscriptionStatus.PENDING);
    }

    @Transactional
    @RequiresModule("EMAIL_NOTIFY")
    public NewsletterList createList(Long tenantId, String rawSlug, String name, String description) {
        String slug = SlugNormalizer.normalize(rawSlug);
        if (newsletterListRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.NEWSLETTER_LIST_SLUG_EXISTS, "Newsletter list slug already exists: " + slug);
        }
        NewsletterList list = new NewsletterList();
        list.setTenant(tenantRepository.getReferenceById(tenantId));
        list.setSlug(slug);
        list.setName(normalizeName(name));
        list.setDescription(normalizeDescription(description));
        list.setStatus(NewsletterListStatus.ACTIVE);
        list.setCreatedBy(SecurityUtils.currentUserId());
        return newsletterListRepository.save(list);
    }

    @Transactional
    @RequiresModule("EMAIL_NOTIFY")
    public NewsletterList updateList(
            Long tenantId,
            Long listId,
            String rawSlug,
            String name,
            String description,
            NewsletterListStatus status
    ) {
        NewsletterList list = requireList(tenantId, listId);
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (newsletterListRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, listId)) {
                throw new ConflictException(ConflictCodes.NEWSLETTER_LIST_SLUG_EXISTS, "Newsletter list slug already exists: " + slug);
            }
            list.setSlug(slug);
        }
        if (name != null) {
            list.setName(normalizeName(name));
        }
        if (description != null) {
            list.setDescription(normalizeDescription(description));
        }
        if (status != null) {
            list.setStatus(status);
        }
        return newsletterListRepository.save(list);
    }

    @Transactional
    @RequiresModule("EMAIL_NOTIFY")
    public NewsletterList archiveList(Long tenantId, Long listId) {
        return updateList(tenantId, listId, null, null, null, NewsletterListStatus.ARCHIVED);
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Newsletter list name is required");
        }
        String normalized = name.trim();
        if (normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Newsletter list name must be at most 255 characters");
        }
        return normalized;
    }

    private static String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        String normalized = description.trim();
        if (normalized.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("Newsletter list description must be at most " + MAX_DESCRIPTION_LENGTH + " characters");
        }
        return normalized;
    }
}
