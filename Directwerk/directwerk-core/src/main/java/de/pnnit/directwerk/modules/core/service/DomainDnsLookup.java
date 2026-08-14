package de.pnnit.directwerk.modules.core.service;

import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;
import javax.naming.NamingEnumeration;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Looks up DNS TXT records for domain verification challenges.
 */
@Component
public class DomainDnsLookup {

    private static final Logger log = LoggerFactory.getLogger(DomainDnsLookup.class);

    /**
     * Looks up TXT records associated with a host.
     *
     * @param host the domain name to query
     * @return the trimmed TXT record values, or an empty list if no records are found or the lookup fails
     */
    public List<String> lookupTxt(String host) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "5000");
        env.put("com.sun.jndi.dns.timeout.retries", "2");
        try {
            DirContext context = new InitialDirContext(env);
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
        } catch (Exception ex) {
            log.warn("DNS TXT lookup failed for host {}: {}", host, ex.getMessage());
            return List.of();
        }
    }
}
