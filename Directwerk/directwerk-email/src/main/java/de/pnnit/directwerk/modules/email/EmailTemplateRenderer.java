package de.pnnit.directwerk.modules.email;

import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
public class EmailTemplateRenderer {

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{([a-zA-Z][a-zA-Z0-9_]*)}}");
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]+>");

    private final EmailTemplateSource templateSource;

    public EmailTemplateRenderer(EmailTemplateSource templateSource) {
        this.templateSource = templateSource;
    }

    public String renderBody(EmailTemplate template, Long tenantId, java.util.Map<String, String> variables) {
        String rawTemplate = templateSource.resolveBody(template, tenantId);
        return render(rawTemplate, variables, true);
    }

    public String renderSubject(EmailTemplate template, Long tenantId, java.util.Map<String, String> variables) {
        String rawTemplate = templateSource.resolveSubject(template, tenantId);
        return render(rawTemplate, variables, false);
    }

    public String renderPlainTextBody(EmailTemplate template, Long tenantId, java.util.Map<String, String> variables) {
        return htmlToPlainText(renderBody(template, tenantId, variables));
    }

    private String render(String template, java.util.Map<String, String> variables, boolean escapeHtml) {
        var matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuilder rendered = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String replacement = variables.getOrDefault(key, matcher.group(0));
            if (escapeHtml) {
                replacement = HtmlUtils.htmlEscape(replacement, java.nio.charset.StandardCharsets.UTF_8.name());
            }
            matcher.appendReplacement(rendered, java.util.regex.Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }

    static String htmlToPlainText(String html) {
        // Tags become a space (not "") so adjacent words don't merge.
        String withoutTags = HTML_TAG_PATTERN.matcher(html).replaceAll(" ");
        String decoded = withoutTags
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">");
        return decoded.replaceAll("\\s+", " ").trim();
    }
}
