package de.pnnit.directwerk.modules.stripebilling.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.stripebilling.exception.StripeSubscriptionRebindRefusedException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Integration-style proof that nested {@code @Transactional(noRollbackFor=...)} refuse does not
 * mark the outer write TX rollback-only — the defect the mocked webhook unit test cannot see
 * because it stubs the sync service past the interceptor.
 */
class StripeRebindRefuseTransactionTest {

    interface SyncPort {
        @Transactional(noRollbackFor = StripeSubscriptionRebindRefusedException.class)
        void upsertThatRefuses();
    }

    static final class SyncPortImpl implements SyncPort {
        @Override
        public void upsertThatRefuses() {
            throw new StripeSubscriptionRebindRefusedException(1L, 2L, "sub_old", "sub_orphan");
        }
    }

    interface RollingSync {
        @Transactional
        void upsertThatRefuses();
    }

    static final class RollingSyncImpl implements RollingSync {
        @Override
        public void upsertThatRefuses() {
            throw new StripeSubscriptionRebindRefusedException(1L, 2L, "sub_old", "sub_orphan");
        }
    }

    @Test
    void outerWriteTxCommitsWhenNestedRefuseIsCaught() {
        PlatformTransactionManager txManager = transactionManager();
        SyncPort sync = transactionalProxy(new SyncPortImpl(), SyncPort.class, txManager);

        AtomicReference<StripeSubscriptionRebindRefusedException> refused = new AtomicReference<>();
        AtomicBoolean committed = new AtomicBoolean(false);
        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            try {
                sync.upsertThatRefuses();
            } catch (StripeSubscriptionRebindRefusedException ex) {
                refused.set(ex);
            }
            committed.set(!status.isRollbackOnly());
        });

        assertThat(refused.get()).isNotNull();
        assertThat(committed.get()).isTrue();
    }

    @Test
    void withoutNoRollbackForOuterWriteTxIsRollbackOnly() {
        PlatformTransactionManager txManager = transactionManager();
        RollingSync sync = transactionalProxy(new RollingSyncImpl(), RollingSync.class, txManager);

        AtomicBoolean rollbackOnly = new AtomicBoolean(false);
        assertThatThrownBy(() -> new TransactionTemplate(txManager).executeWithoutResult(status -> {
            try {
                sync.upsertThatRefuses();
            } catch (StripeSubscriptionRebindRefusedException ex) {
                rollbackOnly.set(status.isRollbackOnly());
            }
        })).isInstanceOf(UnexpectedRollbackException.class);

        assertThat(rollbackOnly.get()).isTrue();
    }

    private static PlatformTransactionManager transactionManager() {
        DataSource dataSource = new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .build();
        return new DataSourceTransactionManager(dataSource);
    }

    @SuppressWarnings("unchecked")
    private static <T> T transactionalProxy(Object target, Class<T> type, PlatformTransactionManager txManager) {
        TransactionInterceptor interceptor = new TransactionInterceptor(
                txManager, new AnnotationTransactionAttributeSource());
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.addInterface(type);
        proxyFactory.addAdvice(interceptor);
        return (T) proxyFactory.getProxy();
    }
}
