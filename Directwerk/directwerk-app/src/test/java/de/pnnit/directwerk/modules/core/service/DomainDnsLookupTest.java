package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import javax.naming.directory.BasicAttribute;
import javax.naming.directory.BasicAttributes;
import javax.naming.directory.DirContext;
import org.junit.jupiter.api.Test;

class DomainDnsLookupTest {

    @Test
    void parsesTxtRecordValuesAndStripsQuotes() throws Exception {
        BasicAttribute txt = new BasicAttribute("TXT");
        txt.add("\"directwerk-verify=abc123\"");
        BasicAttributes attributes = new BasicAttributes();
        attributes.put(txt);
        DirContext context = mock(DirContext.class);
        when(context.getAttributes(eq("example.com"), any(String[].class)))
                .thenReturn(attributes);

        DomainDnsLookup lookup = new DomainDnsLookup(5_000) {
            @Override
            protected DirContext createContext() {
                return context;
            }
        };

        assertThat(lookup.lookupTxt("example.com")).containsExactly("directwerk-verify=abc123");
    }

    @Test
    void returnsEmptyListWhenLookupExceedsOverallDeadline() throws Exception {
        DirContext context = mock(DirContext.class);
        when(context.getAttributes(eq("slow.example.com"), any(String[].class)))
                .thenAnswer(invocation -> {
                    // Simulates a resolver that stalls far beyond the deadline.
                    Thread.sleep(60_000);
                    throw new IllegalStateException("unreachable");
                });

        DomainDnsLookup lookup = new DomainDnsLookup(200) {
            @Override
            protected DirContext createContext() {
                return context;
            }
        };

        long startNanos = System.nanoTime();
        List<String> result = lookup.lookupTxt("slow.example.com");
        long elapsedMillis = (System.nanoTime() - startNanos) / 1_000_000;

        assertThat(result).isEmpty();
        // Prompt abort: well below the 60s stall, roughly at the 200ms deadline.
        assertThat(elapsedMillis).isLessThan(10_000);
    }

    @Test
    void returnsEmptyListWhenHostHasNoTxtRecords() throws Exception {
        DirContext context = mock(DirContext.class);
        when(context.getAttributes(eq("empty.example.com"), any(String[].class)))
                .thenReturn(new BasicAttributes());

        DomainDnsLookup lookup = new DomainDnsLookup(5_000) {
            @Override
            protected DirContext createContext() {
                return context;
            }
        };

        assertThat(lookup.lookupTxt("empty.example.com")).isEmpty();
    }
}
