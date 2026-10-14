package de.pnnit.directwerk.config;

import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Keeps the exported OpenAPI document reproducible (issue #524).
 *
 * <p>The queue and analytics DTOs declare Jackson {@code JsonNode} fields to carry arbitrary JSON
 * ({@code EnqueueJobRequest.payload}, {@code QueueJob.metadata}, {@code StatsView.stats}). springdoc
 * therefore introspects {@code JsonNode} as a bean and emits a schema listing about twenty-five of
 * its getters, in the order a map happens to iterate. Two exports of identical code produced
 * different bytes, so {@code check:openapi} — a plain {@code git diff --exit-code} over the
 * generated types — failed at random and could not be trusted.
 *
 * <p>Replacing that schema with an opaque object fixes the leak as well as the ordering: the
 * published contract described implementation detail ({@code missingNode}, {@code nodeType}, a
 * deprecated {@code textual}) where it meant "arbitrary JSON". The schema name is kept so existing
 * {@code $ref}s and generated type names do not churn.
 */
@Configuration
public class OpenApiSpecConfiguration {

    @Bean
    OpenApiCustomizer arbitraryJsonSchema() {
        return openApi -> {
            if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
                return;
            }
            Map<String, Schema> schemas = openApi.getComponents().getSchemas();
            if (schemas.containsKey("JsonNode")) {
                ObjectSchema arbitraryJson = new ObjectSchema();
                arbitraryJson.setDescription(
                        "Arbitrary JSON value. Opaque by design: its shape is defined by the producer"
                                + " of the payload, not by this contract.");
                // Without this the schema is `type: object` with no properties, which generates a
                // type that forbids every property — the opposite of arbitrary JSON.
                arbitraryJson.setAdditionalProperties(true);
                schemas.put("JsonNode", arbitraryJson);
            }
        };
    }
}
