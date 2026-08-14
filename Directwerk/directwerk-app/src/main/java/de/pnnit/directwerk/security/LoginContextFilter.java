package de.pnnit.directwerk.security;

import de.pnnit.directwerk.config.DirectwerkConfig;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class LoginContextFilter extends OncePerRequestFilter {

    private final DirectwerkConfig directwerkConfig;

    public LoginContextFilter(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!"/oauth2/token".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            String clientId = request.getParameter("client_id");
            LoginContext.setPlatformAdminLogin(
                    directwerkConfig.security().platformClientId().equals(clientId)
            );
            filterChain.doFilter(request, response);
        } finally {
            LoginContext.clear();
        }
    }
}
