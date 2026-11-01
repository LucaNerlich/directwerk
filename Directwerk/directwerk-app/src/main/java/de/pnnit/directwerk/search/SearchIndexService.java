package de.pnnit.directwerk.search;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.search.SearchIndex;
import de.pnnit.directwerk.modules.search.SearchIndexDraft;
import de.pnnit.directwerk.modules.search.SearchKinds;
import de.pnnit.directwerk.modules.search.SearchPlainText;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchIndexService implements SearchIndex {

    private static final int MAX_TITLE = 255;
    private static final int MAX_SLUG = 64;
    private static final int MAX_HREF = 160;

    private final SearchDocumentRepository searchDocumentRepository;
    private final TenantRepository tenantRepository;

    public SearchIndexService(
            SearchDocumentRepository searchDocumentRepository,
            TenantRepository tenantRepository
    ) {
        this.searchDocumentRepository = searchDocumentRepository;
        this.tenantRepository = tenantRepository;
    }

    @Override
    @Transactional
    public void sync(SearchIndexDraft draft) {
        String plain = SearchPlainText.fromHtml(draft.body());
        // PAID articles keep only the author teaser in excerpt; never the start of the body.
        // Episodes and FREE articles still fall back to a body/description prefix.
        boolean paidArticle = SearchKinds.ARTICLE.equals(draft.kind()) && "PAID".equals(draft.access());
        String excerpt = paidArticle
                ? SearchPlainText.authorExcerpt(draft.excerpt())
                : SearchPlainText.excerpt(draft.excerpt(), plain);
        SearchDocument document = searchDocumentRepository
                .findByTenant_IdAndKindAndSourceId(draft.tenantId(), draft.kind(), draft.sourceId())
                .orElseGet(SearchDocument::new);
        if (document.getId() == null) {
            document.setTenant(tenantRepository.getReferenceById(draft.tenantId()));
            document.setKind(draft.kind());
            document.setSourceId(draft.sourceId());
        }
        document.setTitle(clip(draft.title(), MAX_TITLE));
        document.setSlug(clip(draft.slug(), MAX_SLUG));
        document.setPlainText(plain);
        document.setExcerpt(excerpt);
        document.setHrefPath(clip(draft.hrefPath(), MAX_HREF));
        document.setAccess(draft.access());
        searchDocumentRepository.save(document);
    }

    @Override
    @Transactional
    public void remove(long tenantId, String kind, long sourceId) {
        searchDocumentRepository.deleteByTenant_IdAndKindAndSourceId(tenantId, kind, sourceId);
    }

    private static String clip(String value, int max) {
        String text = value == null ? "" : value.trim();
        if (text.length() <= max) {
            return text;
        }
        return text.substring(0, max);
    }
}
