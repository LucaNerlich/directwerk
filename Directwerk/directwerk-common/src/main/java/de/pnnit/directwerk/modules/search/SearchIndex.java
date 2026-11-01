package de.pnnit.directwerk.modules.search;

/**
 * Port for keeping the tenant search index aligned with published content.
 * The table itself is only read through the filtered public endpoint.
 */
public interface SearchIndex {

    SearchIndex NOOP = new SearchIndex() {
        @Override
        public void sync(SearchIndexDraft draft) {
        }

        @Override
        public void remove(long tenantId, String kind, long sourceId) {
        }
    };

    void sync(SearchIndexDraft draft);

    void remove(long tenantId, String kind, long sourceId);
}
