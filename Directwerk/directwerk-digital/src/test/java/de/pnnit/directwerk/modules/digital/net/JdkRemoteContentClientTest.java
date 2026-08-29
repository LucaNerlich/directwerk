package de.pnnit.directwerk.modules.digital.net;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.Test;

class JdkRemoteContentClientTest {

    @Test
    void closesAStalledBodyWhenTheOverallDeadlineExpires() {
        CountDownLatch closed = new CountDownLatch(1);
        InputStream stalled = new InputStream() {
            @Override
            public int read() throws IOException {
                try {
                    closed.await();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IOException("interrupted", ex);
                }
                throw new IOException("closed");
            }

            @Override
            public void close() {
                closed.countDown();
            }
        };

        JdkRemoteContentClient.DeadlineInputStream body =
                new JdkRemoteContentClient.DeadlineInputStream(
                        stalled,
                        Duration.ofMillis(25).toNanos()
                );

        assertThatThrownBy(body::read)
                .isInstanceOf(HttpTimeoutException.class)
                .hasMessageContaining("timed out");
    }
}
