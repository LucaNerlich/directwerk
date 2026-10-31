package de.pnnit.directwerk.modules.queue;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cooperative cancel signal for the job currently running on this thread.
 *
 * <p>When the lease heartbeat detects that another worker re-claimed the job, it marks the
 * current execution cancelled. Handlers that perform multi-step or non-idempotent side effects
 * should poll {@link #isCancelled()} and stop before applying further work. The worker abandons
 * the run (no {@code complete}/{@code fail}) once the flag is set.
 */
public final class JobLeaseCancel {

    private static final ThreadLocal<AtomicBoolean> CURRENT = new ThreadLocal<>();

    private JobLeaseCancel() {
    }

    /**
     * @return {@code true} when the active job's lease was lost mid-run (or no job is active)
     */
    public static boolean isCancelled() {
        AtomicBoolean flag = CURRENT.get();
        return flag != null && flag.get();
    }

    static Scope open() {
        AtomicBoolean flag = new AtomicBoolean(false);
        CURRENT.set(flag);
        return new Scope(flag);
    }

    /** Package-visible for tests that simulate mid-handle lease loss on the worker thread. */
    static void markLostForCurrentJob() {
        AtomicBoolean flag = CURRENT.get();
        if (flag != null) {
            flag.set(true);
        }
    }

    static final class Scope implements AutoCloseable {
        private final AtomicBoolean leaseLost;

        private Scope(AtomicBoolean leaseLost) {
            this.leaseLost = leaseLost;
        }

        boolean isLost() {
            return leaseLost.get();
        }

        void markLost() {
            leaseLost.set(true);
        }

        @Override
        public void close() {
            CURRENT.remove();
        }
    }
}
