package de.pnnit.directwerk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "directwerk.security.platform-client-secret=test-platform-secret",
        "directwerk.security.tenant-client-secret=test-tenant-secret"
})
class DirectwerkApplicationTests {

    @Test
    void contextLoads() {
    }

}
