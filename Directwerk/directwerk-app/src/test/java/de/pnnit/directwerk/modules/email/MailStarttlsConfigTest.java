package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

/** #1039: an env override once flipped prod to cleartext SMTP with a green build. */
class MailStarttlsConfigTest {

    @Test
    void prodAndStageRequireStarttls() {
        for (String profile : new String[]{"prod", "stage"}) {
            YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
            factory.setResources(new ClassPathResource("application-" + profile + ".yaml"));
            Properties properties = factory.getObject();

            assertThat(properties).isNotNull();
            assertThat(properties.getProperty("spring.mail.properties.mail.smtp.starttls.required"))
                    .as("starttls.required in application-%s.yaml", profile)
                    .isEqualToIgnoringCase("true");
        }
    }
}
