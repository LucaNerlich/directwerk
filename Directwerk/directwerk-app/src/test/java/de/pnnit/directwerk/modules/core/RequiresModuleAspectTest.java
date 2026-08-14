package de.pnnit.directwerk.modules.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.stereotype.Component;

/**
 * Targeted regression test for {@link RequiresModuleAspect}.
 *
 * <p>Reproduces the exact real-world proxy shapes that triggered the production bug: a
 * concrete (no-interface) Spring bean whose <em>method</em> carries {@code @RequiresModule}
 * directly - the shape of every affected service ({@code FormatService.createFormat},
 * {@code SubscriptionProductService.createProduct}, {@code CategoryService.createCategory},
 * {@code SeriesService.createSeries}) - and, separately, a bean whose <em>class</em> carries the
 * annotation instead - the shape of the affected controllers
 * ({@code TenantFormatController}, {@code TenantSubscriptionProductController}, etc.).
 *
 * <p>Before the fix, invoking the method-annotated bean threw a bare {@link NullPointerException}
 * from inside the aspect (binding {@code @annotation(requiresModule) || @within(requiresModule)}
 * to a single formal resolved to {@code null} for this shape) instead of ever reaching
 * {@link ModuleGateService#requireModule(String)}. Both shapes must now correctly gate through
 * {@code ModuleGateService}, and unannotated methods on annotated classes must gate too, while
 * methods on unannotated classes without their own annotation must NOT be gated at all.
 */
class RequiresModuleAspectTest {

    private AnnotationConfigApplicationContext context;

    @AfterEach
    void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    void gatesMethodAnnotatedOnAnUnannotatedClass() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        MethodAnnotatedService bean = context.getBean(MethodAnnotatedService.class);

        assertThatCode(bean::createSomething).doesNotThrowAnyException();

        verify(moduleGateService).requireModule(eq("PODCAST"));
    }

    @Test
    void gatesEveryMethodOnAClassAnnotatedAtTheTypeLevel() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        ClassAnnotatedController bean = context.getBean(ClassAnnotatedController.class);

        assertThatCode(bean::handle).doesNotThrowAnyException();

        verify(moduleGateService).requireModule(eq("SUBSCRIPTION"));
    }

    @Test
    void doesNotGateMethodsWithNoAnnotationAnywhere() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        UngatedService bean = context.getBean(UngatedService.class);

        assertThatCode(bean::doWork).doesNotThrowAnyException();

        verifyNoInteractions(moduleGateService);
    }

    @Test
    void propagatesModuleGateServiceRejectionRatherThanSwallowingIt() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        RuntimeException rejection = new RuntimeException("module not enabled");
        org.mockito.Mockito.doThrow(rejection).when(moduleGateService).requireModule("PODCAST");
        context = bootstrapContext(moduleGateService);
        MethodAnnotatedService bean = context.getBean(MethodAnnotatedService.class);

        assertThat(org.assertj.core.api.Assertions.catchThrowable(bean::createSomething))
                .isSameAs(rejection);
    }

    private static AnnotationConfigApplicationContext bootstrapContext(ModuleGateService moduleGateService) {
        AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
        ctx.registerBean(ModuleGateService.class, () -> moduleGateService);
        ctx.register(AspectTestConfig.class);
        ctx.refresh();
        return ctx;
    }

    @Configuration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {

        @Bean
        RequiresModuleAspect requiresModuleAspect(ModuleGateService moduleGateService) {
            return new RequiresModuleAspect(moduleGateService);
        }

        @Bean
        MethodAnnotatedService methodAnnotatedService() {
            return new MethodAnnotatedService();
        }

        @Bean
        ClassAnnotatedController classAnnotatedController() {
            return new ClassAnnotatedController();
        }

        @Bean
        UngatedService ungatedService() {
            return new UngatedService();
        }
    }

    /** Mirrors FormatService/SubscriptionProductService/CategoryService/SeriesService: no class-level annotation. */
    @Component
    static class MethodAnnotatedService {

        @RequiresModule("PODCAST")
        void createSomething() {
            // no-op
        }
    }

    /** Mirrors TenantFormatController/TenantSubscriptionProductController: class-level annotation only. */
    @Component
    @RequiresModule("SUBSCRIPTION")
    static class ClassAnnotatedController {

        void handle() {
            // no-op
        }
    }

    @Component
    static class UngatedService {

        void doWork() {
            // no-op
        }
    }
}
