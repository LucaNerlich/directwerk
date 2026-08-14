package de.pnnit.directwerk.modules.webhook;

/**
 * JSON payload for jobs on the {@code webhook} queue.
 *
 * @param url           target URL (HTTPS only in production handlers)
 * @param eventType     logical event name for logging/metrics
 * @param body          optional JSON body serialized as string
 * @param correlationId optional upstream correlation id
 */
public record WebhookJobPayload(String url, String eventType, String body, String correlationId) {
}
