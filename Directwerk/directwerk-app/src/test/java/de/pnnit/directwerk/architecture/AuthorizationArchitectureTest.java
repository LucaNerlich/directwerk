package de.pnnit.directwerk.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

/**
 * Guards against relying solely on {@code SecurityConfig}'s URL-pattern matchers for
 * authorization. A controller added under the wrong prefix (or with a typo'd request mapping)
 * must still fail closed via method security, so business controllers are required to carry a
 * {@code @PreAuthorize} matching their intended audience.
 */
@AnalyzeClasses(
        packages = "de.pnnit.directwerk.controller",
        importOptions = ImportOption.DoNotIncludeTests.class
)
class AuthorizationArchitectureTest {

    @ArchTest
    static final ArchRule platformControllersRequirePlatformAdminRole = classes()
            .that().resideInAPackage("..controller.platform..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("hasRole('PLATFORM_ADMIN')"))
            .because("platform endpoints must fail closed via method security, not just URL matchers");

    @ArchTest
    static final ArchRule tenantControllersRequireTenantAdminRole = classes()
            .that().resideInAPackage("..controller.tenant..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("hasRole('TENANT_ADMIN')"))
            .because("tenant-admin endpoints must fail closed via method security, not just URL matchers");

    @ArchTest
    static final ArchRule probeControllersRequireProbeRole = classes()
            .that().resideInAPackage("..controller.probe..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("hasAnyRole('EDITOR', 'TENANT_ADMIN')"))
            .because("module probe endpoints must require EDITOR or TENANT_ADMIN via method security");

    @ArchTest
    static final ArchRule mediaControllersRequireEditorRole = classes()
            .that().resideInAPackage("..controller.media..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("hasAnyRole('EDITOR', 'TENANT_ADMIN')"))
            .because("media library endpoints must require EDITOR or TENANT_ADMIN via method security");

    @ArchTest
    static final ArchRule podcastControllersRequireEditorRole = classes()
            .that().resideInAPackage("..controller.podcast..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("hasAnyRole('EDITOR', 'TENANT_ADMIN')"))
            .because("podcast publishing endpoints must require EDITOR or TENANT_ADMIN via method security");

    @ArchTest
    static final ArchRule authenticatedControllersRequireAuthentication = classes()
            .that().resideInAPackage("..controller.authenticated..")
            .and().areAnnotatedWith(RestController.class)
            .should(bePreAuthorizedForExact("isAuthenticated()"))
            .allowEmptyShould(true)
            .because("authenticated endpoints must require authentication via method security");

    private static ArchCondition<JavaClass> bePreAuthorizedForExact(String expectedExpression) {
        return new ArchCondition<JavaClass>("be annotated with @PreAuthorize(\"" + expectedExpression + "\")") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                javaClass.tryGetAnnotationOfType(PreAuthorize.class)
                        .ifPresentOrElse(
                                preAuthorize -> {
                                    String actual = preAuthorize.value();
                                    if (!expectedExpression.equals(actual)) {
                                        events.add(SimpleConditionEvent.violated(javaClass, String.format(
                                                "%s's @PreAuthorize('%s') does not match expected '%s'",
                                                javaClass.getName(), actual, expectedExpression
                                        )));
                                    }
                                },
                                () -> events.add(SimpleConditionEvent.violated(javaClass,
                                        javaClass.getName() + " is missing @PreAuthorize"))
                        );
            }
        };
    }
}
