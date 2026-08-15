package de.pnnit.directwerk.modules.digital.service;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

@Component
public class HtmlSanitizer {

    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3")
            .allowUrlProtocols("https", "http", "mailto", "tel")
            .allowAttributes("href").onElements("a")
            .toFactory();

    public String sanitize(String html) {
        if (html == null) {
            return "";
        }
        return POLICY.sanitize(html);
    }
}
