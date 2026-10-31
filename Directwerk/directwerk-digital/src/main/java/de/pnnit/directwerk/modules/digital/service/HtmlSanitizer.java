package de.pnnit.directwerk.modules.digital.service;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import com.vladsch.flexmark.ext.tables.TablesExtension;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.data.MutableDataSet;

/**
 * Normalizes publication body / show-notes input to the shared content HTML allowlist.
 *
 * <p>Studio TipTap writers send HTML (documents start with a tag). MCP and Markdown
 * importers often send CommonMark, sometimes with inline HTML. Non-TipTap-shaped
 * input is converted with Flexmark, then sanitized. Stored rows and RSS/email
 * therefore see HTML without depending on a client fallback.
 *
 * <p>OWASP re-encodes defense-in-depth characters ({@code = @ + ' `}) as numeric
 * entities. After the allowlist pass those are restored so API/MCP/RSS payloads
 * stay readable; {@code &amp; &lt; &gt; &#34;} remain encoded for markup safety.
 */
@Component
public class HtmlSanitizer {

    private static final Pattern HTTPS_URL = Pattern.compile("^https://[^\\s\"<>`]+$");

    private static final Pattern DECIMAL_ENTITY = Pattern.compile("&#(\\d+);");
    private static final Pattern HEX_ENTITY = Pattern.compile("&#x([0-9a-fA-F]+);");

    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "strong", "em", "s", "a", "ul", "ol", "li", "h2", "h3",
                    "blockquote", "hr", "img", "figure", "figcaption",
                    "table", "thead", "tbody", "tr", "th", "td")
            .allowUrlProtocols("https", "http", "mailto", "tel")
            .allowAttributes("href").onElements("a")
            .allowAttributes("src").matching(HTTPS_URL).onElements("img")
            .allowAttributes("alt", "title").onElements("img")
            .allowAttributes("align").onElements("th", "td")
            .toFactory();

    private static final Parser MARKDOWN_PARSER;
    private static final HtmlRenderer MARKDOWN_RENDERER;

    static {
        MutableDataSet options = new MutableDataSet();
        options.set(Parser.EXTENSIONS, List.of(TablesExtension.create()));
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
        String sanitized;
        if (looksLikeTipTapHtml(htmlOrMarkdown)) {
            sanitized = POLICY.sanitize(htmlOrMarkdown);
        } else {
            String markdown = decodeBasicEntities(htmlOrMarkdown);
            String rendered = MARKDOWN_RENDERER.render(MARKDOWN_PARSER.parse(markdown));
            sanitized = POLICY.sanitize(normalizeHeadingLevels(rendered));
        }
        return relaxCosmeticEntities(sanitized);
    }

    /**
     * TipTap documents start with a tag ({@code <p>}, {@code <h2>}, …). CommonMark
     * that embeds inline HTML mid-body must still go through Flexmark.
     */
    static boolean looksLikeTipTapHtml(String value) {
        return value.trim().startsWith("<");
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

    /**
     * After OWASP allowlisting, restore characters it encodes only for
     * defense-in-depth ({@code = @ + ' `}). Leaves {@code &amp; &lt; &gt; &#34;}
     * alone so markup and double-quoted attributes stay intact. Idempotent with
     * a second {@link #sanitize} pass, so MCP decode-and-rewrite can clear
     * legacy pollution.
     */
    static String relaxCosmeticEntities(String html) {
        if (html == null || html.isEmpty() || html.indexOf('&') < 0) {
            return html;
        }
        return html
                .replace("&#61;", "=")
                .replace("&#x3d;", "=")
                .replace("&#x3D;", "=")
                .replace("&#64;", "@")
                .replace("&#x40;", "@")
                .replace("&#43;", "+")
                .replace("&#x2b;", "+")
                .replace("&#x2B;", "+")
                .replace("&#39;", "'")
                .replace("&#x27;", "'")
                .replace("&apos;", "'")
                .replace("&#96;", "`")
                .replace("&#x60;", "`");
    }

    private static String replaceNumericEntities(String value) {
        Matcher hex = HEX_ENTITY.matcher(value);
        StringBuffer hexOut = new StringBuffer();
        while (hex.find()) {
            String replacement = codePointOrOriginal(hex.group(0), Integer.parseInt(hex.group(1), 16));
            hex.appendReplacement(hexOut, Matcher.quoteReplacement(replacement));
        }
        hex.appendTail(hexOut);

        Matcher dec = DECIMAL_ENTITY.matcher(hexOut.toString());
        StringBuffer decOut = new StringBuffer();
        while (dec.find()) {
            long parsed;
            try {
                parsed = Long.parseLong(dec.group(1), 10);
            } catch (NumberFormatException ex) {
                dec.appendReplacement(decOut, Matcher.quoteReplacement(dec.group(0)));
                continue;
            }
            if (parsed > Integer.MAX_VALUE) {
                dec.appendReplacement(decOut, Matcher.quoteReplacement(dec.group(0)));
                continue;
            }
            String replacement = codePointOrOriginal(dec.group(0), (int) parsed);
            dec.appendReplacement(decOut, Matcher.quoteReplacement(replacement));
        }
        dec.appendTail(decOut);
        return decOut.toString();
    }

    private static String codePointOrOriginal(String original, int codePoint) {
        if (!Character.isValidCodePoint(codePoint)) {
            return original;
        }
        try {
            return new String(Character.toChars(codePoint));
        } catch (IllegalArgumentException ex) {
            return original;
        }
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
