package de.pnnit.directwerk.modules.core.event;

/**
 * Published after a user's password credential changed (e.g. via password
 * reset). Listeners must treat this as a signal to revoke existing sessions —
 * in particular OAuth2 refresh tokens issued before the change, which would
 * otherwise keep yielding fresh access tokens until their natural expiry.
 *
 * @param email the normalized e-mail address (the OAuth2 principal name)
 * @param userId the affected user id
 */
public record PasswordChangedEvent(String email, Long userId) {
}
