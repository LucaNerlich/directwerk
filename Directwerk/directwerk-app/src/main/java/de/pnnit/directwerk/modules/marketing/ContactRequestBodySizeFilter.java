package de.pnnit.directwerk.modules.marketing;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rejects oversized contact-form bodies before Spring deserializes JSON, including chunked requests.
 */
public class ContactRequestBodySizeFilter extends OncePerRequestFilter {

    private final int maxBodyBytes;

    public ContactRequestBodySizeFilter(int maxBodyBytes) {
        this.maxBodyBytes = maxBodyBytes;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod())
                || !"/api/v1/public/contact".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long contentLength = request.getContentLengthLong();
        if (contentLength > maxBodyBytes) {
            writePayloadTooLarge(response);
            return;
        }

        try {
            byte[] body = readLimitedBody(request.getInputStream(), maxBodyBytes);
            filterChain.doFilter(new CachedBodyHttpServletRequest(request, body), response);
        } catch (PayloadTooLargeException ex) {
            writePayloadTooLarge(response);
        }
    }

    private static byte[] readLimitedBody(InputStream input, int maxBytes) throws IOException {
        byte[] buffer = new byte[4096];
        int total = 0;
        int read;
        var body = new java.io.ByteArrayOutputStream(Math.min(maxBytes, 4096));
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new PayloadTooLargeException();
            }
            body.write(buffer, 0, read);
        }
        return body.toByteArray();
    }

    private static void writePayloadTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"status\":413,\"code\":\"PAYLOAD_TOO_LARGE\",\"message\":\"Request body too large\"}"
        );
    }

    private static final class PayloadTooLargeException extends RuntimeException {
    }

    private static final class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        private CachedBodyHttpServletRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            var input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public int read() {
                    return input.read();
                }

                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
