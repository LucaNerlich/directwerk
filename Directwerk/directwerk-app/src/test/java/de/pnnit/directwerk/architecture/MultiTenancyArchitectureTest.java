package de.pnnit.directwerk.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import jakarta.persistence.Entity;
import org.hibernate.annotations.Filter;

@AnalyzeClasses(
        packages = "de.pnnit.directwerk",
        importOptions = ImportOption.DoNotIncludeTests.class
)
class MultiTenancyArchitectureTest {

    private static final DescribedPredicate<JavaClass> HAVE_TENANT_FIELD =
            new DescribedPredicate<>("have a field of type Tenant") {
                @Override
                public boolean test(JavaClass javaClass) {
                    return javaClass.getAllFields().stream()
                            .anyMatch(field -> field.getRawType().isAssignableTo(Tenant.class));
                }
            };

    @ArchTest
    static final ArchRule tenantControllersDoNotDependOnRepositories = noClasses()
            .that().resideInAPackage("..controller.tenant..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("tenant controllers must use services that enforce TenantContext scoping");

    @ArchTest
    static final ArchRule podcastControllersDoNotDependOnRepositories = noClasses()
            .that().resideInAPackage("..controller.podcast..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("podcast controllers must use services that enforce TenantContext scoping");

    @ArchTest
    static final ArchRule tenantOwnedEntitiesHaveHibernateFilter = classes()
            .that().areAnnotatedWith(Entity.class)
            .and().implement(TenantOwned.class)
            .should().beAnnotatedWith(Filter.class)
            .andShould(new ArchCondition<JavaClass>("have Filter annotation with name 'tenantFilter'") {
                @Override
                public void check(JavaClass javaClass, ConditionEvents events) {
                    javaClass.tryGetAnnotationOfType(Filter.class).ifPresent(filter -> {
                        String filterName = filter.name();
                        if (!de.pnnit.directwerk.multitenancy.TenantFilters.FILTER_NAME.equals(filterName)) {
                            String message = String.format(
                                    "Filter name '%s' does not match TenantFilters.FILTER_NAME in %s",
                                    filterName,
                                    javaClass.getName()
                            );
                            events.add(SimpleConditionEvent.violated(javaClass, message));
                        }
                    });
                }
            })
            .because("TenantOwned entities must declare the Hibernate tenantFilter");

    @ArchTest
    static final ArchRule entitiesWithTenantAssociationAreTenantOwned = classes()
            .that().areAnnotatedWith(Entity.class)
            .and(HAVE_TENANT_FIELD)
            .and().doNotHaveSimpleName("TenantDomain")
            .should().implement(TenantOwned.class)
            .because("entities with a Tenant association must opt into TenantOwned isolation "
                    + "(TenantDomain is excluded: host resolution is a global lookup)");
}
