package de.pnnit.directwerk.modules.digital.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.data.MutableDataSet;

/**
 * Normalizes publication body / show-notes input to the shared content HTML allowlist.
 *
 * <p>Studio TipTap writers send HTML. MCP and Markdown importers often send CommonMark.
 * Non-HTML input is converted with Flexmark, then sanitized. Stored rows and RSS/email
 * therefore see HTML without depending on a client fallback.
 */
@Component
public class HtmlSanitizer {

    private static final Pattern HTTPS_URL = Pattern.compile("^https://[^\\s\"<>`]+$");

    /** Tags TipTap and the allowlist emit — presence means treat as HTML, not Markdown. */
    private static final Pattern CONTENT_HTML_TAG = Pattern.compile(
            "</?(?:p|br|strong|em|s|a|ul|ol|li|h[1-6]|blockquote|hr|img|figure|figcaption)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern DECIMAL_ENTITY = Pattern.compile("&#(\\d+);");
    private static final Pattern HEX_ENTITY = Pattern.compile("&#x([0-9a-fA-F]+);");

    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "strong", "em", "s", "a", "ul", "ol", "li", "h2", "h3",
                    "blockquote", "hr", "img", "figure", "figcaption")
            .allowUrlProtocols("https", "http", "mailto", "tel")
            .allowAttributes("href").onElements("a")
            .allowAttributes("src").matching(HTTPS_URL).onElements("img")
            .allowAttributes("alt", "title").onElements("img")
            .toFactory();

    private static final Parser MARKDOWN_PARSER;
    private static final HtmlRenderer MARKDOWN_RENDERER;

    static {
        MutableDataSet options = new MutableDataSet();
        MARKDOWN_PARSER = Parser.builder(options).build();
        MARKDOWN_RENDERER = HtmlRenderer.builder(options).build();
    }

    /**
     * Accepts TipTap HTML or CommonMark; always returns sanitized HTML (or empty).
     */
    public String sanitize(String htmlOrMarkdown) {
        if (htmlOrMarkdown == null || htmlOrMarkdown.isEmpty()) {
            return "";
        }
        if (looksLikeContentHtml(htmlOrMarkdown)) {
            return POLICY.sanitize(htmlOrMarkdown);
        }
        String markdown = decodeBasicEntities(htmlOrMarkdown);
        String rendered = MARKDOWN_RENDERER.render(MARKDOWN_PARSER.parse(markdown));
        return POLICY.sanitize(normalizeHeadingLevels(rendered));
    }

    static boolean looksLikeContentHtml(String value) {
        return CONTENT_HTML_TAG.matcher(value).find();
    }

    /**
     * OWASP may have escaped prior Markdown writes (`&gt;`, `&amp;`). Decode before Flexmark.
     */
    static String decodeBasicEntities(String value) {
        String decoded = value
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'");
        decoded = replaceNumericEntities(decoded);
        return decoded.replace("&amp;", "&");
    }

    private static String replaceNumericEntities(String value) {
        Matcher hex = HEX_ENTITY.matcher(value);
        StringBuffer hexOut = new StringBuffer();
        while (hex.find()) {
            hex.appendReplacement(hexOut, Matcher.quoteReplacement(
                    new String(Character.toChars(Integer.parseInt(hex.group(1), 16)))));
        }
        hex.appendTail(hexOut);

        Matcher dec = DECIMAL_ENTITY.matcher(hexOut.toString());
        StringBuffer decOut = new StringBuffer();
        while (dec.find()) {
            dec.appendReplacement(decOut, Matcher.quoteReplacement(
                    new String(Character.toChars(Integer.parseInt(dec.group(1), 10)))));
        }
        dec.appendTail(decOut);
        return decOut.toString();
    }

    /** TipTap only offers h2/h3; Markdown {@code #} becomes h1 — remap so sanitize keeps headings. */
    static String normalizeHeadingLevels(String html) {
        return html
                .replaceAll("(?i)<h1(\\s|>)", "<h2$1")
                .replaceAll("(?i)</h1>", "</h2>")
                .replaceAll("(?i)<h([4-6])(\\s|>)", "<h3$2")
                .replaceAll("(?i)</h[4-6]>", "</h3>");
    }
}
