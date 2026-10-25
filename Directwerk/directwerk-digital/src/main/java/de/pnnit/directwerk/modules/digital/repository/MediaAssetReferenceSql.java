package de.pnnit.directwerk.modules.digital.repository;

/**
 * Shared native-SQL fragments for content attachment checks on {@code media_assets}.
 *
 * <p>Keep {@link #ATTACHED_REFERENCES_PREDICATE} as the single definition of “still in use”
 * so delete guards and the unreferenced list filter cannot drift.
 */
final class MediaAssetReferenceSql {

    private MediaAssetReferenceSql() {
    }

    /**
     * True when media_assets row alias {@code m} is referenced by episode audio linkage or any
     * content FK (series/format cover, episode audio/cover, article hero, digital publication).
     */
    static final String ATTACHED_REFERENCES_PREDICATE = """
            (m.episode_id IS NOT NULL
             OR EXISTS (SELECT 1 FROM podcast_series s WHERE s.cover_asset_id = m.id)
             OR EXISTS (SELECT 1 FROM formats f WHERE f.cover_asset_id = m.id)
             OR EXISTS (SELECT 1 FROM episodes e WHERE e.audio_asset_id = m.id OR e.cover_asset_id = m.id)
             OR EXISTS (SELECT 1 FROM articles a WHERE a.hero_asset_id = m.id)
             OR EXISTS (SELECT 1 FROM digital_publications d WHERE d.asset_id = m.id))
            """;

    static final String HAS_ATTACHED_REFERENCES = """
            SELECT EXISTS (
                SELECT 1 FROM media_assets m WHERE m.id = :id AND
            """ + ATTACHED_REFERENCES_PREDICATE + """
            )
            """;

    private static final String TYPE_STATUS_FOLDER_ROOT = """
            SELECT m.id FROM media_assets m
            WHERE m.tenant_id = :tenantId
              AND (CAST(:assetType AS VARCHAR) IS NULL OR m.asset_type = CAST(:assetType AS VARCHAR))
              AND (
                    (CAST(:status AS VARCHAR) IS NOT NULL AND m.status = CAST(:status AS VARCHAR))
                    OR (CAST(:status AS VARCHAR) IS NULL AND m.status NOT IN ('ARCHIVED', 'PENDING_DELETE'))
                  )
            """;

    static final String FIND_FILTERED_UNREFERENCED_IDS = TYPE_STATUS_FOLDER_ROOT + """
              AND NOT """ + ATTACHED_REFERENCES_PREDICATE + """
            ORDER BY m.id DESC
            """;

    static final String FIND_FILTERED_UNASSIGNED_UNREFERENCED_IDS = TYPE_STATUS_FOLDER_ROOT + """
              AND m.folder_id IS NULL
              AND NOT """ + ATTACHED_REFERENCES_PREDICATE + """
            ORDER BY m.id DESC
            """;

    static final String FIND_FILTERED_IN_FOLDERS_UNREFERENCED_IDS = TYPE_STATUS_FOLDER_ROOT + """
              AND m.folder_id IN (:folderIds)
              AND NOT """ + ATTACHED_REFERENCES_PREDICATE + """
            ORDER BY m.id DESC
            """;
}
