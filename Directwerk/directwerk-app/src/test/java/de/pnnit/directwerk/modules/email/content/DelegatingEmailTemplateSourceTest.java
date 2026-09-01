package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.email.ClasspathEmailTemplateSource;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.entity.TenantContentEmailTemplate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DelegatingEmailTemplateSourceTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private ClasspathEmailTemplateSource classpathEmailTemplateSource;

    @Mock
    private TenantContentEmailTemplateService tenantContentEmailTemplateService;

    private DelegatingEmailTemplateSource source;

    @BeforeEach
    void setUp() {
        source = new DelegatingEmailTemplateSource(classpathEmailTemplateSource, tenantContentEmailTemplateService);
    }

    @Test
    void usesTenantOverrideForContentTemplateWhenPresent() {
        TenantContentEmailTemplate override = new TenantContentEmailTemplate();
        override.setSubjectTemplate("Custom subject");
        override.setBodyHtml("<p>Custom body</p>");
        when(tenantContentEmailTemplateService.findTemplate(TENANT_ID, ContentType.ARTICLE))
                .thenReturn(Optional.of(override));

        assertThat(source.resolveSubject(EmailTemplate.CONTENT_ARTICLE_PUBLISHED, TENANT_ID)).isEqualTo("Custom subject");
        assertThat(source.resolveBody(EmailTemplate.CONTENT_ARTICLE_PUBLISHED, TENANT_ID)).isEqualTo("<p>Custom body</p>");
        verify(classpathEmailTemplateSource, never()).resolveSubject(any(), any());
        verify(classpathEmailTemplateSource, never()).resolveBody(any(), any());
    }

    @Test
    void fallsBackToClasspathWhenNoTenantOverrideExists() {
        when(tenantContentEmailTemplateService.findTemplate(TENANT_ID, ContentType.EPISODE))
                .thenReturn(Optional.empty());
        when(classpathEmailTemplateSource.resolveSubject(EmailTemplate.CONTENT_EPISODE_PUBLISHED, TENANT_ID))
                .thenReturn("New episode: {{title}}");
        when(classpathEmailTemplateSource.resolveBody(EmailTemplate.CONTENT_EPISODE_PUBLISHED, TENANT_ID))
                .thenReturn("<p>{{title}}</p>");

        assertThat(source.resolveSubject(EmailTemplate.CONTENT_EPISODE_PUBLISHED, TENANT_ID)).isEqualTo("New episode: {{title}}");
        assertThat(source.resolveBody(EmailTemplate.CONTENT_EPISODE_PUBLISHED, TENANT_ID)).isEqualTo("<p>{{title}}</p>");
    }

    @Test
    void bypassesTenantLookupForNonContentTemplates() {
        when(classpathEmailTemplateSource.resolveSubject(EmailTemplate.PASSWORD_RESET, TENANT_ID))
                .thenReturn("Reset your password");

        assertThat(source.resolveSubject(EmailTemplate.PASSWORD_RESET, TENANT_ID)).isEqualTo("Reset your password");
        verify(tenantContentEmailTemplateService, never()).findTemplate(any(), any());
    }

    @Test
    void bypassesTenantLookupWhenTenantIdIsNull() {
        when(classpathEmailTemplateSource.resolveBody(EmailTemplate.CONTENT_ARTICLE_PUBLISHED, null))
                .thenReturn("<p>Default body</p>");

        assertThat(source.resolveBody(EmailTemplate.CONTENT_ARTICLE_PUBLISHED, null)).isEqualTo("<p>Default body</p>");
        verify(tenantContentEmailTemplateService, never()).findTemplate(any(), any());
    }
}
