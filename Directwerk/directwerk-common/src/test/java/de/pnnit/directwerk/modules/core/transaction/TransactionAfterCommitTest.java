package de.pnnit.directwerk.modules.core.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class TransactionAfterCommitTest {

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void runsImmediatelyWithoutATransaction() {
        AtomicBoolean ran = new AtomicBoolean(false);

        TransactionAfterCommit.run(() -> ran.set(true));

        assertThat(ran).isTrue();
    }

    @Test
    void swallowsAFailingAfterCommitAction() {
        TransactionSynchronizationManager.initSynchronization();
        AtomicBoolean ran = new AtomicBoolean(false);

        TransactionAfterCommit.run(() -> {
            ran.set(true);
            throw new IllegalStateException("audit insert failed");
        });

        assertThat(ran).isFalse();
        assertThatCode(() -> TransactionSynchronizationManager.getSynchronizations()
                .forEach(TransactionSynchronization::afterCommit))
                .doesNotThrowAnyException();
        assertThat(ran).isTrue();
    }
}
