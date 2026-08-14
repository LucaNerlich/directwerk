package de.pnnit.directwerk.modules.core;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.lang.reflect.Method;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;

/**
 * Enforces {@link RequiresModule} on any method whose own declaration or whose declaring type
 * carries the annotation.
 *
 * <p>The pointcut intentionally matches broadly ({@code @annotation(RequiresModule) ||
 * @within(RequiresModule)}) but does <strong>not</strong> bind the annotation instance as an
 * advice parameter. Binding a single formal to two different annotation designators combined
 * with {@code ||} is not reliably supported by Spring AOP/AspectJ: when a join point matches
 * only one of the two disjuncts (e.g. a service method carries the annotation but its class does
 * not, or vice versa), the framework can resolve the bound parameter to {@code null} depending on
 * evaluation order, throwing a {@link NullPointerException} instead of enforcing the gate. This
 * was observed in practice for every {@code POST} create endpoint whose service method carries
 * {@code @RequiresModule} directly (formats, subscription products, categories, series) while the
 * declaring service class itself is not annotated.
 *
 * <p>Resolving the annotation manually in the advice body — checking the most specific method
 * first, then its declaring class — sidesteps that ambiguity entirely and works for both
 * annotation placements.
 */
@Aspect
@Component
@RequiredArgsConstructor
public class RequiresModuleAspect {

    private final ModuleGateService moduleGateService;

    @Before("@annotation(de.pnnit.directwerk.modules.core.RequiresModule) "
            + "|| @within(de.pnnit.directwerk.modules.core.RequiresModule)")
    public void enforceModule(JoinPoint joinPoint) {
        RequiresModule requiresModule = resolveAnnotation(joinPoint);
        if (requiresModule == null) {
            // Defensive: the pointcut guarantees a match exists, but never NPE if resolution
            // somehow fails - fail closed by doing nothing would be wrong, so surface clearly.
            throw new IllegalStateException(
                    "RequiresModuleAspect matched a join point without a resolvable @RequiresModule annotation: "
                            + joinPoint.getSignature());
        }
        moduleGateService.requireModule(requiresModule.value());
    }

    private static RequiresModule resolveAnnotation(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object target = joinPoint.getTarget();
        Class<?> targetClass = target != null ? target.getClass() : method.getDeclaringClass();
        Method mostSpecificMethod = AopUtils.getMostSpecificMethod(method, targetClass);

        RequiresModule onMethod = AnnotatedElementUtils.findMergedAnnotation(mostSpecificMethod, RequiresModule.class);
        if (onMethod != null) {
            return onMethod;
        }
        return AnnotatedElementUtils.findMergedAnnotation(targetClass, RequiresModule.class);
    }
}
