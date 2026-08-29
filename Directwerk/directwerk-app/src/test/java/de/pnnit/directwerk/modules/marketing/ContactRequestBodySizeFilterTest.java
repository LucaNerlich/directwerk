package de.pnnit.directwerk.modules.marketing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletResponse;

class ContactRequestBodySizeFilterTest {

    @Test
    void rejectsChunkedBodyLargerThanLimitBeforeController() throws Exception {
        ContactRequestBodySizeFilter filter =
                new ContactRequestBodySizeFilter(ContactFormLimits.MAX_REQUEST_BODY_BYTES);
        HttpServletRequest request = mock(HttpServletRequest.class);
        whenContactPost(request);
        when(request.getContentLengthLong()).thenReturn(-1L);
        byte[] oversized = new byte[ContactFormLimits.MAX_REQUEST_BODY_BYTES + 1];
        when(request.getInputStream()).thenReturn(new DelegatingServletInputStream(new ByteArrayInputStream(oversized)));

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE.value());
        assertThat(response.getContentAsString()).contains("PAYLOAD_TOO_LARGE");
        verifyNoMoreInteractions(chain);
    }

    @Test
    void rejectsDeclaredContentLengthAboveLimit() throws Exception {
        ContactRequestBodySizeFilter filter =
                new ContactRequestBodySizeFilter(ContactFormLimits.MAX_REQUEST_BODY_BYTES);
        HttpServletRequest request = mock(HttpServletRequest.class);
        whenContactPost(request);
        when(request.getContentLengthLong()).thenReturn((long) ContactFormLimits.MAX_REQUEST_BODY_BYTES + 1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE.value());
        verifyNoMoreInteractions(chain);
    }

    @Test
    void allowsBodyWithinLimit() throws Exception {
        ContactRequestBodySizeFilter filter =
                new ContactRequestBodySizeFilter(ContactFormLimits.MAX_REQUEST_BODY_BYTES);
        HttpServletRequest request = mock(HttpServletRequest.class);
        whenContactPost(request);
        byte[] body = "{\"name\":\"Jane\"}".getBytes(StandardCharsets.UTF_8);
        when(request.getContentLengthLong()).thenReturn((long) body.length);
        when(request.getInputStream()).thenReturn(new DelegatingServletInputStream(new ByteArrayInputStream(body)));

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), same(response));
    }

    private static void whenContactPost(HttpServletRequest request) {
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/public/contact");
    }

    private static final class DelegatingServletInputStream extends jakarta.servlet.ServletInputStream {

        private final java.io.InputStream delegate;

        private DelegatingServletInputStream(java.io.InputStream delegate) {
            this.delegate = delegate;
        }

        @Override
        public int read() throws java.io.IOException {
            return delegate.read();
        }

        @Override
        public boolean isFinished() {
            return false;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(jakarta.servlet.ReadListener readListener) {
            throw new UnsupportedOperationException();
        }
    }
}
