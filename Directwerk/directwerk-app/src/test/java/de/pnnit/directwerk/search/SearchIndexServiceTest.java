package de.pnnit.directwerk.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.search.SearchIndexDraft;
import de.pnnit.directwerk.modules.search.SearchKinds;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SearchIndexServiceTest {

    @Mock
    private SearchDocumentRepository searchDocumentRepository;

    @Mock
    private TenantRepository tenantRepository;

    private SearchIndexService service;

    @BeforeEach
    void setUp() {
        service = new SearchIndexService(searchDocumentRepository, tenantRepository);
        when(searchDocumentRepository.findByTenant_IdAndKindAndSourceId(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(tenantRepository.getReferenceById(10L)).thenReturn(new Tenant());
        when(searchDocumentRepository.save(any(SearchDocument.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void paidArticleWithBlankExcerptDoesNotStoreBodyPrefix() {
        service.sync(new SearchIndexDraft(
                10L,
                SearchKinds.ARTICLE,
                7L,
                "Paid",
                "paid",
                "<p>secret paid sentence</p>",
                null,
                "/articles/paid",
                "PAID"
        ));

        ArgumentCaptor<SearchDocument> captor = ArgumentCaptor.forClass(SearchDocument.class);
        verify(searchDocumentRepository).save(captor.capture());
        assertThat(captor.getValue().getPlainText()).isEqualTo("secret paid sentence");
        assertThat(captor.getValue().getExcerpt()).isEmpty();
    }

    @Test
    void freeArticleStillFallsBackToBodyPrefixWhenExcerptBlank() {
        service.sync(new SearchIndexDraft(
                10L,
                SearchKinds.ARTICLE,
                8L,
                "Free",
                "free",
                "<p>public free sentence</p>",
                "  ",
                "/articles/free",
                "FREE"
        ));

        ArgumentCaptor<SearchDocument> captor = ArgumentCaptor.forClass(SearchDocument.class);
        verify(searchDocumentRepository).save(captor.capture());
        assertThat(captor.getValue().getExcerpt()).isEqualTo("public free sentence");
    }

    @Test
    void paidArticleKeepsAuthorTeaser() {
        service.sync(new SearchIndexDraft(
                10L,
                SearchKinds.ARTICLE,
                7L,
                "Paid",
                "paid",
                "<p>secret paid sentence</p>",
                "<em>Public teaser</em>",
                "/articles/paid",
                "PAID"
        ));

        ArgumentCaptor<SearchDocument> captor = ArgumentCaptor.forClass(SearchDocument.class);
        verify(searchDocumentRepository).save(captor.capture());
        assertThat(captor.getValue().getExcerpt()).isEqualTo("Public teaser");
        verify(searchDocumentRepository).findByTenant_IdAndKindAndSourceId(eq(10L), eq(SearchKinds.ARTICLE), eq(7L));
    }
}
