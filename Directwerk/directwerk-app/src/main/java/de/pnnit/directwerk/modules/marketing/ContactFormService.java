package de.pnnit.directwerk.modules.marketing;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class ContactFormService {

    private final DirectwerkConfig directwerkConfig;
    private final AltchaService altchaService;
    private final EmailJobProducer emailJobProducer;

    public ContactFormService(
            DirectwerkConfig directwerkConfig,
            AltchaService altchaService,
            EmailJobProducer emailJobProducer
    ) {
        this.directwerkConfig = directwerkConfig;
        this.altchaService = altchaService;
        this.emailJobProducer = emailJobProducer;
    }

    public void submit(String name, String email, String message, String altchaPayload) {
        if (!directwerkConfig.isContactFormEnabled()) {
            throw new ContactFormDisabledException();
        }
        altchaService.verifyPayload(altchaPayload);

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("name", name.trim());
        variables.put("email", email.trim());
        variables.put("message", message.trim());

        emailJobProducer.enqueueContactForm(
                directwerkConfig.marketing().contact().inboxEmail(),
                variables
        );
    }
}
