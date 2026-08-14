package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

class AuthControllerMappingTest {

    @Test
    void relocatedAuthControllerKeepsExistingUrlsAndAddsAcceptInvite() {
        RequestMapping mapping = AuthController.class.getAnnotation(RequestMapping.class);
        assertThat(mapping.value()).containsExactly("/api/v1/auth");

        assertThat(postMappingValues()).contains(
                "/register",
                "/forgot-password",
                "/reset-password",
                "/accept-invite"
        );
    }

    private static String[] postMappingValues() {
        return Arrays.stream(AuthController.class.getDeclaredMethods())
                .map(method -> method.getAnnotation(PostMapping.class))
                .filter(annotation -> annotation != null)
                .flatMap(annotation -> Arrays.stream(annotation.value()))
                .toArray(String[]::new);
    }
}
