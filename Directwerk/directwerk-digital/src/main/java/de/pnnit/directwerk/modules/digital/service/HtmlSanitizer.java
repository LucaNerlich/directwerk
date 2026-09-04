package de.pnnit.directwerk.modules.digital.service;

import java.util.regex.Pattern;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

@Component
public class HtmlSanitizer {

    private static final Pattern HTTPS_URL = Pattern.compile("^https://[^\\s\"<>`]+$");

    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3",
                    "img", "figure", "figcaption")
            .allowUrlProtocols("https", "http", "mailto", "tel")
            .allowAttributes("href").onElements("a")
            .allowAttributes("src").matching(HTTPS_URL).onElements("img")
            .allowAttributes("alt", "title").onElements("img")
            .toFactory();

    public String sanitize(String html) {
        if (html == null) {
            return "";
        }
        return POLICY.sanitize(html);
    }
}
