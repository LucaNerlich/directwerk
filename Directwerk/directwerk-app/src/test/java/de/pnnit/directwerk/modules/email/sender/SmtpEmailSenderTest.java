package de.pnnit.directwerk.modules.email.sender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

@ExtendWith(MockitoExtension.class)
class SmtpEmailSenderTest {

    @Mock
    private JavaMailSender mailSender;

    private SmtpEmailSender smtpEmailSender;

    @BeforeEach
    void setUp() {
        smtpEmailSender = new SmtpEmailSender(mailSender);
    }

    @Test
    void sendBuildsMultipartMimeMessage() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getDefaultInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        smtpEmailSender.send(new OutboundEmail(
                "user@example.com",
                "noreply@directwerk.local",
                "Directwerk",
                "Reset your password",
                "<p>http://localhost:3000/reset-password?token=reset-token</p>",
                "http://localhost:3000/reset-password?token=reset-token",
                "00000000-0000-0000-0000-000000000001",
                "PASSWORD_RESET",
                Map.of()
        ));

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        MimeMessage sentMessage = messageCaptor.getValue();
        assertThat(sentMessage.getSubject()).isEqualTo("Reset your password");
        assertThat(sentMessage.getHeader("X-Directwerk-Job-Id")[0])
                .isEqualTo("00000000-0000-0000-0000-000000000001");
        assertThat(readBody(sentMessage)).contains("http://localhost:3000/reset-password?token=reset-token");
    }

    @Test
    void sendWrapsTransportFailure() {
        MimeMessage mimeMessage = new MimeMessage(Session.getDefaultInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> smtpEmailSender.send(new OutboundEmail(
                "user@example.com",
                "noreply@directwerk.local",
                "Directwerk",
                "Reset your password",
                "<p>body</p>",
                "body",
                "job-1",
                "PASSWORD_RESET",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class).hasMessageContaining("Email delivery failed");
    }

    private static String readBody(MimeMessage message) throws Exception {
        return extractText(message.getContent());
    }

    private static String extractText(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof MimeMultipart multipart) {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                builder.append(extractText(multipart.getBodyPart(i).getContent()));
            }
            return builder.toString();
        }
        if (content instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        if (content instanceof jakarta.activation.DataSource dataSource) {
            dataSource.getInputStream().transferTo(buffer);
            return buffer.toString(StandardCharsets.UTF_8);
        }
        return String.valueOf(content);
    }
}
