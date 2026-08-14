package de.pnnit.directwerk.modules.email.sender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.Map;
import org.junit.jupiter.api.Test;

class NoneEmailSenderTest {

    private final NoneEmailSender sender = new NoneEmailSender();

    @Test
    void isNotReadyAndDoesNotThrow() {
        assertThat(sender.providerId()).isEqualTo("none");
        assertThat(sender.isReady()).isFalse();
        assertThatCode(() -> sender.send(new OutboundEmail(
                "user@example.com",
                "noreply@publish.local",
                "Directwerk",
                "Subject",
                "<p>body</p>",
                "body",
                "job-1",
                "PASSWORD_RESET",
                Map.of()
        ))).doesNotThrowAnyException();
    }
}
