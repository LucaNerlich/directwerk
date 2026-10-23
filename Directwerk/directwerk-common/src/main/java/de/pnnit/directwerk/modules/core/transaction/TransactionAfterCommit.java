package de.pnnit.directwerk.modules.core.transaction;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs a side effect after the current transaction commits, or immediately when
 * there is no transaction.
 */
public final class TransactionAfterCommit {

    private static final Logger log = LoggerFactory.getLogger(TransactionAfterCommit.class);

    private TransactionAfterCommit() {
    }

    public static void run(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // The row is already durable: a failing side effect (audit insert,
                    // refresh enqueue) must not turn the committed request into an error.
                    try {
                        action.run();
                    } catch (RuntimeException ex) {
                        log.error("After-commit action failed; the transaction is already committed", ex);
                    }
                }
            });
            return;
        }
        action.run();
    }
}
