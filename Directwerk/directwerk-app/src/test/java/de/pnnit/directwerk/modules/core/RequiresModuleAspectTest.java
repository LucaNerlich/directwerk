package de.pnnit.directwerk.modules.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.EpisodeLinkValidator;
import de.pnnit.directwerk.modules.podcast.service.EpisodeLinkValidatorImpl;
import de.pnnit.directwerk.modules.podcast.service.EpisodeService;
import java.util.List;
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
 * {@link ModuleGateService#requireModules(java.util.Collection)}. Both shapes must now correctly gate through
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

        verify(moduleGateService).requireModules(eq(List.of("PODCAST")));
    }

    @Test
    void gatesEveryMethodOnAClassAnnotatedAtTheTypeLevel() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        ClassAnnotatedController bean = context.getBean(ClassAnnotatedController.class);

        assertThatCode(bean::handle).doesNotThrowAnyException();

        verify(moduleGateService).requireModules(eq(List.of("SUBSCRIPTION")));
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
        org.mockito.Mockito.doThrow(rejection).when(moduleGateService).requireModules(List.of("PODCAST"));
        context = bootstrapContext(moduleGateService);
        MethodAnnotatedService bean = context.getBean(MethodAnnotatedService.class);

        assertThat(org.assertj.core.api.Assertions.catchThrowable(bean::createSomething))
                .isSameAs(rejection);
    }

    @Test
    void methodAndTypeAnnotationsAccumulateWithAndSemantics() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        MultiModuleUnionBean bean = context.getBean(MultiModuleUnionBean.class);

        assertThatCode(bean::handle).doesNotThrowAnyException();

        // One batched enforcement call: method keys first (declaration order), then class key.
        verify(moduleGateService).requireModules(eq(List.of("SUBSCRIPTION", "PODCAST_RSS", "PODCAST")));
        org.mockito.Mockito.verifyNoMoreInteractions(moduleGateService);
    }

    @Test
    void typeLevelAnnotationAloneStillGatesUngatedMethodsOnUnionBeans() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        MultiModuleUnionBean bean = context.getBean(MultiModuleUnionBean.class);

        assertThatCode(bean::ungatedMethod).doesNotThrowAnyException();

        verify(moduleGateService).requireModules(eq(List.of("PODCAST")));
        verify(moduleGateService, org.mockito.Mockito.times(1))
                .requireModules(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void singleKeyWithoutBracesStaysCompatibleWithStringArrayInterface() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        context = bootstrapContext(moduleGateService);
        SingleKeyStillWorks bean = context.getBean(SingleKeyStillWorks.class);

        assertThatCode(bean::createSomething).doesNotThrowAnyException();

        verify(moduleGateService).requireModules(eq(List.of("DIGITAL_CONTENT")));
    }

    @Test
    void episodeLinkValidatorIsFailClosedWhenPodcastModuleIsDisabled() {
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        RuntimeException rejection = new RuntimeException("PODCAST disabled");
        org.mockito.Mockito.doThrow(rejection).when(moduleGateService).requireModules(List.of("PODCAST"));
        context = bootstrapContext(moduleGateService);
        EpisodeLinkValidator validator = context.getBeanProvider(EpisodeLinkValidator.class).getIfAvailable();

        assertThat(validator).isNotNull();
        assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> validator.episodeExists(1L, 2L)))
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

        @Bean
        MultiModuleUnionBean multiModuleUnionBean() {
            return new MultiModuleUnionBean();
        }

        @Bean
        SingleKeyStillWorks singleKeyStillWorks() {
            return new SingleKeyStillWorks();
        }

        @Bean
        EpisodeLinkValidatorImpl episodeLinkValidator(EpisodeService episodeService) {
            return new EpisodeLinkValidatorImpl(episodeService);
        }

        @Bean
        EpisodeService episodeService() {
            return mock(EpisodeService.class);
        }
    }

    /** Method + type annotations accumulate: every key from both must be active (AND). */
    @Component
    @RequiresModule("PODCAST")
    static class MultiModuleUnionBean {

        @RequiresModule({"SUBSCRIPTION", "PODCAST_RSS"})
        void handle() {
            // no-op
        }

        void ungatedMethod() {
            // still gated by the type annotation only
        }
    }

    /** A single key written without braces stays source-compatible with String[] value(). */
    @Component
    static class SingleKeyStillWorks {

        @RequiresModule("DIGITAL_CONTENT")
        void createSomething() {
            // no-op
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
