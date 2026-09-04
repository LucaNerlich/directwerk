package de.pnnit.directwerk.modules.marketing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ContactFormServiceTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private AltchaService altchaService;

    @Mock
    private EmailJobProducer emailJobProducer;

    private ContactFormService service;

    @BeforeEach
    void setUp() {
        service = new ContactFormService(directwerkConfig, altchaService, emailJobProducer);
    }

    @Test
    void submitEnqueuesEmailWhenEnabled() {
        stubEnabledContactForm();
        service.submit("Jane Doe", "jane@example.com", "Hello there", "payload");

        verify(altchaService).verifyPayload("payload");
        verify(emailJobProducer).enqueueContactForm(
                "hello@directwerk.org",
                java.util.Map.of(
                        "name", "Jane Doe",
                        "email", "jane@example.com",
                        "message", "Hello there"
                )
        );
    }

    @Test
    void submitFailsWhenDisabled() {
        when(directwerkConfig.isContactFormEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.submit("Jane", "jane@example.com", "Hi", "payload"))
                .isInstanceOf(ContactFormDisabledException.class);
    }

    @Test
    void submitEnqueuesEmailOnlyOnceForReplayedAltchaPayload() throws Exception {
        stubEnabledContactForm();
        AltchaService realAltchaService = AltchaServiceTest.serviceWithKey("test-key");
        ContactFormService replayAwareService =
                new ContactFormService(directwerkConfig, realAltchaService, emailJobProducer);
        String payload = AltchaTestSupport.createValidPayload("test-key");

        replayAwareService.submit("Jane Doe", "jane@example.com", "Hello there", payload);

        assertThatThrownBy(() ->
                        replayAwareService.submit("Jane Doe", "jane@example.com", "Hello there", payload))
                .isInstanceOf(CaptchaVerificationException.class);

        verify(emailJobProducer, times(1)).enqueueContactForm(
                "hello@directwerk.org",
                java.util.Map.of(
                        "name", "Jane Doe",
                        "email", "jane@example.com",
                        "message", "Hello there"
                )
        );
    }

    private void stubEnabledContactForm() {
        when(directwerkConfig.isContactFormEnabled()).thenReturn(true);
        when(directwerkConfig.marketing()).thenReturn(new DirectwerkProperties.Marketing(
                new DirectwerkProperties.Contact(
                        true,
                        "hello@directwerk.org",
                        5,
                        List.of("http://localhost:3005"),
                        new DirectwerkProperties.Altcha("test-key", 300)
                )
        ));
    }
}
