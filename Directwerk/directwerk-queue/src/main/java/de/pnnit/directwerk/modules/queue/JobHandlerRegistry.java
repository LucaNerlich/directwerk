package de.pnnit.directwerk.modules.queue;

import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Collects {@link JobHandler} beans at startup. Allowed queue names are derived from registered handlers.
 */
@Component
public class JobHandlerRegistry {

    private final Map<String, JobHandler> handlersByQueue;

    public JobHandlerRegistry(Collection<JobHandler> handlers) {
        this.handlersByQueue = handlers.stream()
                .collect(Collectors.toUnmodifiableMap(
                        JobHandler::queueName,
                        Function.identity(),
                        (left, right) -> {
                            throw new IllegalStateException(
                                    "Duplicate JobHandler registration for queue '%s' (%s and %s)"
                                            .formatted(left.queueName(), left.getClass().getName(), right.getClass().getName())
                            );
                        }
                ));
        if (handlersByQueue.isEmpty()) {
            throw new IllegalStateException("At least one JobHandler must be registered");
        }
    }

    public Set<String> registeredQueues() {
        return handlersByQueue.keySet();
    }

    public boolean isRegistered(String queue) {
        return handlersByQueue.containsKey(queue);
    }

    public JobHandler handlerFor(String queue) {
        return handlersByQueue.get(queue);
    }

    public JobHandler requireHandler(String queue) {
        JobHandler handler = handlersByQueue.get(queue);
        if (handler == null) {
            throw new IllegalArgumentException("Queue is not allowed: " + queue);
        }
        return handler;
    }

    public JobHandlerSettings settingsFor(String queue) {
        return requireHandler(queue).settings();
    }
}
