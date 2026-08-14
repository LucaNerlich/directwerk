package de.pnnit.directwerk.api.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Bridges exceptions thrown from servlet {@link jakarta.servlet.Filter}s into the same
 * {@code @ExceptionHandler} mapping that {@link GlobalExceptionHandler} applies to
 * controller-thrown exceptions.
 *
 * <p>Filters such as {@code TenantContextFilter} and {@code TenantMembershipGuardFilter} run
 * before {@code DispatcherServlet} even begins dispatching, so an exception thrown there can
 * never reach a {@code @RestControllerAdvice} through the normal Spring MVC exception-resolution
 * path — it falls through to the servlet container's generic error page instead. Spring's
 * {@code handlerExceptionResolver} bean (the same composite {@code DispatcherServlet} consults)
 * can be invoked directly to resolve an exception and write the response, which lets filters
 * reuse the exact status/error-code mapping declared in {@link GlobalExceptionHandler} without
 * duplicating it.
 */
@Component
public class FilterExceptionResolver {

    private final HandlerExceptionResolver handlerExceptionResolver;

    public FilterExceptionResolver(
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver handlerExceptionResolver
    ) {
        this.handlerExceptionResolver = handlerExceptionResolver;
    }

    /**
     * Resolves {@code ex} through the shared {@code @ExceptionHandler} mapping, writing the JSON
     * error response directly onto {@code response}.
     *
     * @param request  the current request
     * @param response the current response, written to if {@code ex} can be resolved
     * @param ex       the exception to resolve
     * @throws RuntimeException the original {@code ex}, rethrown unchanged, if no
     *                          {@code @ExceptionHandler} could resolve it
     */
    public void resolve(HttpServletRequest request, HttpServletResponse response, RuntimeException ex) {
        if (handlerExceptionResolver.resolveException(request, response, null, ex) == null) {
            throw ex;
        }
    }
}
