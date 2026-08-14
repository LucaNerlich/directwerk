package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class JobHandlerRegistryTest {

    @Test
    void registersHandlersByQueueName() {
        JobHandlerRegistry registry = new JobHandlerRegistry(List.of(
                handler("email"),
                handler("webhook")
        ));

        assertThat(registry.registeredQueues()).containsExactlyInAnyOrder("email", "webhook");
        assertThat(registry.requireHandler("email").queueName()).isEqualTo("email");
    }

    @Test
    void rejectsDuplicateQueueNames() {
        assertThatThrownBy(() -> new JobHandlerRegistry(List.of(handler("email"), handler("email"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate JobHandler");
    }

    private static JobHandler handler(String queue) {
        return new JobHandler() {
            @Override
            public String queueName() {
                return queue;
            }

            @Override
            public void handle(QueueJob job) {
            }
        };
    }
}
