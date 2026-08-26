package de.pnnit.directwerk.modules.core;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequiresModule {

    /**
     * Module keys that must ALL be active for the annotated element to be reachable.
     * A single key may be written without braces: {@code @RequiresModule(PODCAST_MODULE_KEY)}.
     */
    String[] value();
}
