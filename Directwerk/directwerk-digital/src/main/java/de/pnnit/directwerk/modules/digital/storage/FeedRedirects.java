package de.pnnit.directwerk.modules.digital.storage;

import java.net.URI;
import java.net.URL;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Shared 302/404 response shaping for generated-feed delivery (podcast RSS, article RSS, ...).
 * Feed responses are always {@code Cache-Control: no-store} so podcatchers/readers cannot pin
 * the redirect target and skip Directwerk after a module or feed is turned off.
 */
public final class FeedRedirects {

    private FeedRedirects() {
    }

    public static ResponseEntity<String> rssRedirect(URL redirectUrl, boolean ready) {
        if (!ready) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(CacheControl.noStore())
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(redirectUrl.toString()))
                .cacheControl(CacheControl.noStore())
                .build();
    }
}
