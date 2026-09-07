package de.pnnit.directwerk.controller.newsletter;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class ArticleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ArticleService articleService;

    @MockitoBean
    private ArticlePublicationWorkflowService articlePublicationWorkflowService;

    @MockitoBean
    private ModuleGateService moduleGateService;

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setTenantId(10L);
        doNothing().when(moduleGateService).requireModule(ArgumentMatchers.anyString());
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void deleteArticleReturnsNoContent() throws Exception {
        doNothing().when(articleService).deleteArticle(10L, 7L);

        mockMvc.perform(delete("/api/v1/articles/{articleId}", 7L))
                .andExpect(status().isNoContent());

        verify(articleService).deleteArticle(10L, 7L);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void deleteArticleReturnsNotFoundForForeignTenantItem() throws Exception {
        doThrow(new ArticleNotFoundException(7L)).when(articleService).deleteArticle(10L, 7L);

        mockMvc.perform(delete("/api/v1/articles/{articleId}", 7L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("ARTICLE_NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "SUBSCRIBER")
    void deleteArticleRejectsSubscriberRole() throws Exception {
        mockMvc.perform(delete("/api/v1/articles/{articleId}", 7L))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishReturnsViews() throws Exception {
        when(articlePublicationWorkflowService.bulkPublish(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq(List.of(7L, 8L)),
                ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull()))
                .thenReturn(List.of(article(7L), article(8L)));

        mockMvc.perform(post("/api/v1/articles/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8],\"notifySubscribers\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(7))
                .andExpect(jsonPath("$.data[1].id").value(8));

        verify(articlePublicationWorkflowService).bulkPublish(10L, List.of(7L, 8L), false, null);
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishRejectsEmptyIds() throws Exception {
        mockMvc.perform(post("/api/v1/articles/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"publish", "unpublish", "delete"})
    @WithMockUser(roles = "EDITOR")
    void bulkOperationsRejectNullIdsBeforeCallingServices(String operation) throws Exception {
        mockMvc.perform(post("/api/v1/articles/bulk/{operation}", operation)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,null]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));

        verifyNoInteractions(articlePublicationWorkflowService, articleService);
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishReturnsNotFoundForUnknownId() throws Exception {
        when(articlePublicationWorkflowService.bulkPublish(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq(List.of(7L, 8L)),
                ArgumentMatchers.anyBoolean(),
                ArgumentMatchers.isNull()))
                .thenThrow(new ArticleNotFoundException(8L));

        mockMvc.perform(post("/api/v1/articles/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("ARTICLE_NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkUnpublishReturnsViews() throws Exception {
        when(articlePublicationWorkflowService.bulkUnpublish(10L, List.of(7L)))
                .thenReturn(List.of(article(7L)));

        mockMvc.perform(post("/api/v1/articles/bulk/unpublish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        verify(articlePublicationWorkflowService).bulkUnpublish(10L, List.of(7L));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkDeleteReturnsDeletedIds() throws Exception {
        when(articleService.bulkDelete(10L, List.of(7L, 8L))).thenReturn(List.of(7L, 8L));

        mockMvc.perform(post("/api/v1/articles/bulk/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deletedIds[0]").value(7))
                .andExpect(jsonPath("$.data.deletedIds[1]").value(8));

        verify(articleService).bulkDelete(10L, List.of(7L, 8L));
    }

    @Test
    @WithMockUser(roles = "SUBSCRIBER")
    void bulkDeleteRejectsSubscriberRole() throws Exception {
        mockMvc.perform(post("/api/v1/articles/bulk/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7]}"))
                .andExpect(status().isForbidden());
    }

    private static Article article(Long id) {
        Article article = new Article();
        article.setId(id);
        article.setSlug("article-" + id);
        article.setTitle("Article " + id);
        article.setBody("<p>Body</p>");
        article.setAccessPolicy(AccessPolicy.FREE);
        article.setStatus(ArticleStatus.PUBLISHED);
        return article;
    }
}
