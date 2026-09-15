package de.pnnit.directwerk.modules.digital.net;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.net.InetAddress;
import java.net.URI;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class RemoteUrlValidatorTest {

    @Test
    void resolvePublicAddressesFailsFastOnHangingDns() throws InterruptedException {
        CountDownLatch resolverStarted = new CountDownLatch(1);
        long start = System.nanoTime();

        assertThatThrownBy(() -> RemoteUrlValidator.resolvePublicAddresses("blackhole.example", () -> {
            resolverStarted.countDown();
            Thread.sleep(60_000);
            return new InetAddress[0];
        }))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");

        assertThat(resolverStarted.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(System.nanoTime() - start).isLessThan(TimeUnit.SECONDS.toNanos(10));
    }

    @Test
    void rejectsResolutionWhenTimedOutResolversIgnoreInterruption() throws InterruptedException {
        CountDownLatch resolversStarted = new CountDownLatch(RemoteUrlValidator.RESOLVER_MAX_CONCURRENCY);
        CountDownLatch releaseResolvers = new CountDownLatch(1);
        CountDownLatch resolversFinished = new CountDownLatch(RemoteUrlValidator.RESOLVER_MAX_CONCURRENCY);

        try {
            for (int i = 0; i < RemoteUrlValidator.RESOLVER_MAX_CONCURRENCY; i++) {
                assertThatThrownBy(() -> RemoteUrlValidator.resolvePublicAddresses(
                        "blackhole.example",
                        () -> {
                            resolversStarted.countDown();
                            try {
                                boolean released = false;
                                while (!released) {
                                    try {
                                        releaseResolvers.await();
                                        released = true;
                                    } catch (InterruptedException ignored) {
                                        // Simulate a native resolver that does not respond to interruption.
                                    }
                                }
                            } finally {
                                resolversFinished.countDown();
                            }
                            return new InetAddress[]{InetAddress.getByName("1.1.1.1")};
                        },
                        100
                ))
                        .isInstanceOf(UploadValidationException.class)
                        .hasMessageContaining("in time");
            }
            assertThat(resolversStarted.await(1, TimeUnit.SECONDS)).isTrue();

            for (int i = 0; i < RemoteUrlValidator.RESOLVER_QUEUE_CAPACITY; i++) {
                assertThatThrownBy(() -> RemoteUrlValidator.resolvePublicAddresses(
                        "queued.example",
                        () -> new InetAddress[]{InetAddress.getByName("1.1.1.1")},
                        10
                ))
                        .isInstanceOf(UploadValidationException.class)
                        .hasMessageContaining("in time");
            }

            assertThatThrownBy(() -> RemoteUrlValidator.resolvePublicAddresses(
                    "rejected.example",
                    () -> new InetAddress[]{InetAddress.getByName("1.1.1.1")},
                    100
            ))
                    .isInstanceOf(UploadValidationException.class)
                    .hasMessageContaining("capacity is exhausted");
        } finally {
            releaseResolvers.countDown();
            assertThat(resolversFinished.await(1, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void acceptsPublicHttpsUrl() {
        URI uri = RemoteUrlValidator.requirePublicHttpUrl("https://1.1.1.1/podcast.xml");
        assertThat(uri.getHost()).isEqualTo("1.1.1.1");
    }

    @Test
    void rejectsPrivateIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://127.0.0.1/secret"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsSiteLocalIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://10.0.0.1/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsCarrierGradeNatIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://100.64.0.1/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsUniqueLocalIpv6() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://[fd00::1]/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsLocalhostHostname() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://localhost/feed.xml"))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsUserInfo() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("https://user:pass@example.com/a"))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsFileScheme() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("file:///etc/passwd"))
                .isInstanceOf(UploadValidationException.class);
    }
}
