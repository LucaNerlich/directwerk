package de.pnnit.directwerk.docs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exports the springdoc-generated OpenAPI spec to {@code directwerk-docs/docs/openapi/}.
 *
 * <p>Run via {@code ./gradlew :directwerk-app:exportOpenApi} — not part of the default test suite.
 */
@Tag("openapi-export")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiExportTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void writeOpenApiSpec() throws Exception {
        String json = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(json).isNotBlank();
        assertThat(json).contains("\"openapi\"");

        Path output = Path.of(System.getProperty(
                "openapi.output",
                "../../directwerk-docs/docs/openapi/directwerk-api.json"));
        Files.createDirectories(output.getParent());
        Files.writeString(output, json);

        assertThat(Files.size(output)).isGreaterThan(1_000);
    }
}
