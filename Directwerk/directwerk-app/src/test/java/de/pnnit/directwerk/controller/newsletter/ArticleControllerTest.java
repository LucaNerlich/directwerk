package de.pnnit.directwerk.controller.newsletter;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
}
