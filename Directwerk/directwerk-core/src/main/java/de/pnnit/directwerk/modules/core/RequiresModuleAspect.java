package de.pnnit.directwerk.modules.core;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
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
        List<String> moduleKeys = resolveRequiredModuleKeys(joinPoint);
        if (moduleKeys.isEmpty()) {
            // Defensive: the pointcut guarantees a match exists, but never silently pass if
            // resolution somehow fails - surface clearly instead.
            throw new IllegalStateException(
                    "RequiresModuleAspect matched a join point without a resolvable @RequiresModule annotation: "
                            + joinPoint.getSignature());
        }
        for (String moduleKey : moduleKeys) {
            moduleGateService.requireModule(moduleKey);
        }
    }

    /**
     * Method-level and type-level annotations <strong>accumulate</strong>: every key from the most
     * specific method annotation plus every key from the declaring class annotation must be active
     * (AND semantics). Keys are enforced in declaration order (method first, then type),
     * deduplicated.
     */
    private static List<String> resolveRequiredModuleKeys(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object target = joinPoint.getTarget();
        Class<?> targetClass = target != null ? target.getClass() : method.getDeclaringClass();
        Method mostSpecificMethod = AopUtils.getMostSpecificMethod(method, targetClass);

        RequiresModule onMethod = AnnotatedElementUtils.findMergedAnnotation(mostSpecificMethod, RequiresModule.class);
        RequiresModule onType = AnnotatedElementUtils.findMergedAnnotation(targetClass, RequiresModule.class);

        if (onMethod == null && onType == null) {
            return List.of();
        }
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        if (onMethod != null) {
            Collections.addAll(keys, onMethod.value());
        }
        if (onType != null) {
            Collections.addAll(keys, onType.value());
        }
        return List.copyOf(keys);
    }
}
