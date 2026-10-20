package de.pnnit.directwerk.modules.core.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.net.InetAddress;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.junit.jupiter.api.Test;

/**
 * Issue #569: a replaced DNS entry must not close the HTTP client while a request is running
 * on it.
 */
class UmamiPinnedClientTest {

    @Test
    void retiresWithoutClosingWhileARequestIsInFlight() throws Exception {
        CloseableHttpClient client = mock(CloseableHttpClient.class);
        UmamiEventClient.PinnedEventSender.PinnedClient pinned =
                new UmamiEventClient.PinnedEventSender.PinnedClient(
                        new InetAddress[] {InetAddress.getLoopbackAddress()},
                        client
                );

        assertThat(pinned.tryAcquire()).isTrue();
        pinned.retire();
        verify(client, never()).close();

        pinned.release();
        verify(client).close();
    }

    @Test
    void refusesToAcquireARetiredClient() throws Exception {
        CloseableHttpClient client = mock(CloseableHttpClient.class);
        UmamiEventClient.PinnedEventSender.PinnedClient pinned =
                new UmamiEventClient.PinnedEventSender.PinnedClient(new InetAddress[0], client);

        pinned.retire();

        assertThat(pinned.tryAcquire()).isFalse();
        verify(client).close();
    }
}
