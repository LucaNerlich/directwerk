package de.pnnit.directwerk.modules.core.service;

import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Looks up DNS TXT records for domain verification challenges.
 *
 * <p>JNDI's {@code com.sun.jndi.dns.timeout.*} properties bound each attempt per
 * nameserver, not the whole lookup - with several configured resolvers and retries a
 * single call can block for tens of seconds. Because {@link TenantDomainService#verifyDomain}
 * runs inside a DB transaction, an overall wall-clock deadline is enforced around the
 * JNDI call so the transaction can never be held open indefinitely.
 */
@Component
public class DomainDnsLookup {

    private static final Logger log = LoggerFactory.getLogger(DomainDnsLookup.class);

    /** Hard end-to-end cap for one TXT lookup regardless of server count or retries. */
    static final long DEFAULT_DEADLINE_MILLIS = 10_000;

    private final long deadlineMillis;
    private final ExecutorService lookupExecutor;

    public DomainDnsLookup() {
        this(DEFAULT_DEADLINE_MILLIS);
    }

    DomainDnsLookup(long deadlineMillis) {
        this.deadlineMillis = deadlineMillis;
        this.lookupExecutor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "dns-txt-lookup");
            thread.setDaemon(true);
            return thread;
        });
    }

    /**
     * Looks up TXT records associated with a host.
     *
     * @param host the domain name to query
     * @return the trimmed TXT record values, or an empty list if no records are found,
     *         the lookup fails, or it exceeds the overall deadline
     */
    public List<String> lookupTxt(String host) {
        Future<List<String>> pending = lookupExecutor.submit(() -> queryTxt(host));
        try {
            return pending.get(deadlineMillis, TimeUnit.MILLISECONDS);
        } catch (TimeoutException ex) {
            // Best-effort interrupt; the JNDI socket read may not react, but this caller
            // stops waiting immediately and the daemon thread never blocks JVM shutdown.
            pending.cancel(true);
            log.warn(
                    "DNS TXT lookup exceeded the {}ms overall deadline for host {}",
                    deadlineMillis,
                    host
            );
            return List.of();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            pending.cancel(true);
            return List.of();
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause();
            log.warn("DNS TXT lookup failed for host {}: {}",
                    host, cause == null ? ex.getMessage() : cause.getMessage());
            return List.of();
        }
    }

    private List<String> queryTxt(String host) throws NamingException {
        DirContext context = createContext();
        try {
            Attributes attributes = context.getAttributes(host, new String[] {"TXT"});
            Attribute txt = attributes.get("TXT");
            if (txt == null) {
                return List.of();
            }
            List<String> values = new ArrayList<>();
            NamingEnumeration<?> enumeration = txt.getAll();
            while (enumeration.hasMore()) {
                Object value = enumeration.next();
                if (value != null) {
                    values.add(value.toString().replace("\"", "").trim());
                }
            }
            return List.copyOf(values);
        } finally {
            context.close();
        }
    }

    /**
     * Creates the JNDI context; protected so tests can substitute a slow/failing one.
     */
    protected DirContext createContext() throws NamingException {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "5000");
        env.put("com.sun.jndi.dns.timeout.retries", "2");
        return new InitialDirContext(env);
    }

    @jakarta.annotation.PreDestroy
    void shutdown() {
        lookupExecutor.shutdownNow();
    }
}
