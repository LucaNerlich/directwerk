package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class EmailTemplateRendererTest {

    private final EmailTemplateRenderer renderer = new EmailTemplateRenderer(new ClasspathEmailTemplateSource());

    @Test
    void renderBodyReplacesPlaceholdersAndEscapesValues() {
        String rendered = renderer.renderBody(
                EmailTemplate.PASSWORD_RESET,
                null,
                Map.of(
                        "resetUrl", "http://localhost/reset?token=<script>",
                        "expiresIn", "1 hour"
                )
        );

        assertThat(rendered).contains("http://localhost/reset?token=&lt;script&gt;");
        assertThat(rendered).contains("1 hour");
        assertThat(rendered).doesNotContain("{{resetUrl}}");
    }

    @Test
    void renderSubjectReplacesPlaceholders() {
        String rendered = renderer.renderSubject(
                EmailTemplate.TENANT_INVITATION,
                null,
                Map.of("tenantName", "R&D")
        );

        assertThat(rendered).isEqualTo("You've been invited to R&D");
    }

    @Test
    void leavesUnknownPlaceholdersUntouched() {
        String rendered = renderer.renderSubject(
                EmailTemplate.TENANT_INVITATION,
                null,
                Map.of()
        );

        assertThat(rendered).isEqualTo("You've been invited to {{tenantName}}");
    }

    @Test
    void htmlToPlainTextPreservesSpacesBetweenWords() {
        String html = "<p>Reset your password</p><div>Hello world</div>";
        String plainText = EmailTemplateRenderer.htmlToPlainText(html);

        assertThat(plainText).contains("Reset your password");
        assertThat(plainText).contains("Hello world");
        assertThat(plainText).doesNotContain("Resetyourpassword");
        assertThat(plainText).doesNotContain("Helloworld");
    }
}
