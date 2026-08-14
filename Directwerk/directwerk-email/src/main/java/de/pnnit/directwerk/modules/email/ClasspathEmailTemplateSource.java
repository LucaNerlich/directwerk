package de.pnnit.directwerk.modules.email;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

@Component
public class ClasspathEmailTemplateSource implements EmailTemplateSource {

    @Override
    public String resolveBody(EmailTemplate template, Long tenantId) {
        return loadTemplate(template.classpathPath());
    }

    @Override
    public String resolveSubject(EmailTemplate template, Long tenantId) {
        return template.subjectTemplate();
    }

    private static String loadTemplate(String classpathPath) {
        ClassPathResource resource = new ClassPathResource(classpathPath);
        try (InputStream inputStream = resource.getInputStream()) {
            return StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load email template: " + classpathPath, ex);
        }
    }
}
