package de.pnnit.directwerk.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import org.junit.jupiter.api.Test;
import org.springdoc.core.customizers.OpenApiCustomizer;

/**
 * Guards the fix for issue #524: the introspected {@code JsonNode} schema was the one part of the
 * exported document whose byte output varied between runs.
 */
class OpenApiSpecConfigurationTest {

    private final OpenApiCustomizer customizer = new OpenApiSpecConfiguration().arbitraryJsonSchema();

    @Test
    void replacesTheIntrospectedJsonNodeSchemaWithAnOpaqueObject() {
        OpenAPI openApi = new OpenAPI();
        Components components = new Components();
        Schema<?> introspected = new ObjectSchema();
        introspected.addProperty("missingNode", new BooleanSchema());
        introspected.addProperty("nodeType", new StringSchema());
        components.addSchemas("JsonNode", introspected);
        components.addSchemas("Unrelated", new StringSchema());
        openApi.setComponents(components);

        customizer.customise(openApi);

        Schema<?> resolved = openApi.getComponents().getSchemas().get("JsonNode");
        // No property map means nothing left for springdoc to order unstably...
        assertThat(resolved.getProperties()).isNull();
        // ...and additionalProperties keeps it usable as arbitrary JSON rather than an object that
        // forbids every property.
        assertThat(resolved.getAdditionalProperties()).isEqualTo(true);
        assertThat(openApi.getComponents().getSchemas().get("Unrelated")).isInstanceOf(StringSchema.class);
    }

    @Test
    void leavesDocumentsWithoutAJsonNodeSchemaUntouched() {
        OpenAPI openApi = new OpenAPI();
        Components components = new Components();
        components.addSchemas("Unrelated", new StringSchema());
        openApi.setComponents(components);

        customizer.customise(openApi);

        assertThat(openApi.getComponents().getSchemas()).containsOnlyKeys("Unrelated");
    }

    @Test
    void toleratesADocumentWithoutComponents() {
        // A document with no components at all must not blow up the customizer.
        assertThatCode(() -> customizer.customise(new OpenAPI())).doesNotThrowAnyException();
    }
}
