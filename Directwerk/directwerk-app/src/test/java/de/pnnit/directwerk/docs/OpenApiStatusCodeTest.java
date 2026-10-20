package de.pnnit.directwerk.docs;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Pins the success response codes of representative handlers against the generated spec
 * (issue #549 review). Fails when a handler's real status and the published contract drift apart
 * — the mismatch that let the first pass ship with seven 201 handlers still exporting 200.
 */
class OpenApiStatusCodeTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void declaredSuccessCodesMatchTheHandlers() throws IOException {
        JsonNode paths = MAPPER.readTree(specPath().toFile()).path("paths");

        assertThat(successCodes(paths, "/api/v1/articles", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/episodes", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/me/feeds", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/me/article-feeds", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/tenant/users/invite", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/media/upload-url", "post")).containsExactly("201");
        assertThat(successCodes(paths, "/api/v1/articles/{articleId}", "delete")).contains("204");
        // Re-import answers 200, a first import 201; async asset ingest answers 202, sync 201.
        assertThat(successCodes(paths, "/api/v1/articles/import/articles", "post"))
                .containsExactly("200", "201");
        assertThat(successCodes(paths, "/api/v1/podcast/import/episodes", "post"))
                .containsExactly("200", "201");
        assertThat(successCodes(paths, "/api/v1/podcast/import/assets", "post"))
                .containsExactly("201", "202");
    }

    private static Set<String> successCodes(JsonNode paths, String path, String method) {
        JsonNode responses = paths.path(path).path(method).path("responses");
        assertThat(responses.isMissingNode())
                .as("operation %s %s exists in the spec", method.toUpperCase(), path)
                .isFalse();
        Set<String> codes = new TreeSet<>();
        responses.propertyNames().forEach(name -> {
            if (name.startsWith("2")) {
                codes.add(name);
            }
        });
        return codes;
    }

    private static Path specPath() {
        Path cursor = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (cursor != null) {
            Path candidate = cursor.resolve("directwerk-docs/docs/openapi/directwerk-api.json");
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("OpenAPI spec not found from " + System.getProperty("user.dir"));
    }
}
