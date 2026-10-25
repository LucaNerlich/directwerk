package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.S3Error;
import software.amazon.awssdk.services.s3.model.S3Exception;

@ExtendWith(MockitoExtension.class)
class S3BulkObjectDeleterTest {

    @Mock
    private S3Client s3Client;

    private S3BulkObjectDeleter deleter;

    @BeforeEach
    void setUp() {
        deleter = new S3BulkObjectDeleter(s3Client);
    }

    @Test
    void deleteQuietlyNoOpsOnEmptyOrBlankKeys() {
        deleter.deleteQuietly("bucket", List.of());
        deleter.deleteQuietly("bucket", java.util.Arrays.asList(" ", "", null));
        verify(s3Client, never()).deleteObjects(any(DeleteObjectsRequest.class));
    }

    @Test
    void deleteQuietlyRequiresBucket() {
        assertThatThrownBy(() -> deleter.deleteQuietly(" ", List.of("a/key")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(s3Client, never()).deleteObjects(any(DeleteObjectsRequest.class));
    }

    @Test
    void deleteQuietlySendsQuietDeleteObjectsAndDedupes() {
        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenReturn(DeleteObjectsResponse.builder().build());

        deleter.deleteQuietly("directwerk-dev", List.of(
                "alpha/staging/a.mp3",
                "alpha/staging/a.mp3",
                "alpha/staging/b.mp3"
        ));

        ArgumentCaptor<DeleteObjectsRequest> captor = ArgumentCaptor.forClass(DeleteObjectsRequest.class);
        verify(s3Client).deleteObjects(captor.capture());
        DeleteObjectsRequest request = captor.getValue();
        assertThat(request.bucket()).isEqualTo("directwerk-dev");
        assertThat(request.delete().quiet()).isTrue();
        assertThat(request.delete().objects().stream().map(ObjectIdentifier::key))
                .containsExactly("alpha/staging/a.mp3", "alpha/staging/b.mp3");
    }

    @Test
    void deleteQuietlyChunksAboveBunnyLimit() {
        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenReturn(DeleteObjectsResponse.builder().build());

        List<String> keys = IntStream.range(0, S3BulkObjectDeleter.MAX_KEYS_PER_REQUEST + 3)
                .mapToObj(i -> "alpha/staging/file-" + i + ".mp3")
                .toList();

        deleter.deleteQuietly("directwerk-dev", keys);

        ArgumentCaptor<DeleteObjectsRequest> captor = ArgumentCaptor.forClass(DeleteObjectsRequest.class);
        verify(s3Client, times(2)).deleteObjects(captor.capture());
        List<DeleteObjectsRequest> requests = captor.getAllValues();
        assertThat(requests.get(0).delete().objects()).hasSize(S3BulkObjectDeleter.MAX_KEYS_PER_REQUEST);
        assertThat(requests.get(1).delete().objects()).hasSize(3);
        List<String> allKeys = new ArrayList<>();
        for (DeleteObjectsRequest request : requests) {
            request.delete().objects().forEach(object -> allKeys.add(object.key()));
        }
        assertThat(allKeys).containsExactlyElementsOf(keys);
    }

    @Test
    void deleteQuietlyIgnoresNotFoundErrorsInResponse() {
        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenReturn(DeleteObjectsResponse.builder()
                        .errors(S3Error.builder()
                                .key("alpha/staging/gone.mp3")
                                .code("NoSuchKey")
                                .message("gone")
                                .build())
                        .build());

        deleter.deleteQuietly("directwerk-dev", List.of("alpha/staging/gone.mp3"));

        verify(s3Client).deleteObjects(any(DeleteObjectsRequest.class));
    }

    @Test
    void deleteQuietlyThrowsOnNonNotFoundErrors() {
        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenReturn(DeleteObjectsResponse.builder()
                        .errors(S3Error.builder()
                                .key("alpha/staging/locked.mp3")
                                .code("AccessDenied")
                                .message("denied")
                                .build())
                        .build());

        assertThatThrownBy(() -> deleter.deleteQuietly(
                "directwerk-dev",
                List.of("alpha/staging/locked.mp3")
        )).isInstanceOf(S3Exception.class)
                .hasMessageContaining("AccessDenied");
    }

    @Test
    void deleteQuietlyPropagatesS3ExceptionUnlessNotFound() {
        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(503).message("unavailable").build());

        assertThatThrownBy(() -> deleter.deleteQuietly("directwerk-dev", List.of("a/key")))
                .isInstanceOf(S3Exception.class);

        when(s3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).message("not found").build());

        deleter.deleteQuietly("directwerk-dev", List.of("a/key"));
    }
}
