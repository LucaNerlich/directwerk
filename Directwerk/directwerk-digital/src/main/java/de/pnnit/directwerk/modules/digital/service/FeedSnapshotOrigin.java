package de.pnnit.directwerk.modules.digital.service;

/**
 * Resolved absolute origin (scheme, host, port) used when generating snapshot feed XML.
 * Kept separate from the storage layer so each content kind can apply its own fallback
 * policy when a tenant has no verified public host.
 */
public record FeedSnapshotOrigin(String scheme, String host, int port) {
}
