package de.pnnit.directwerk.modules.content;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Helpers for JSONB {@code working_draft} overlays on published content.
 * Keys are camelCase to match Studio/API field names.
 */
public final class WorkingDraftMaps {

    public static final String SLUG = "slug";
    public static final String TITLE = "title";
    public static final String BODY = "body";
    public static final String EXCERPT = "excerpt";
    public static final String SEO_DESCRIPTION = "seoDescription";
    public static final String HERO_ASSET_ID = "heroAssetId";
    public static final String CLEAR_HERO_ASSET = "clearHeroAsset";
    public static final String DESCRIPTION = "description";
    public static final String COVER_ASSET_ID = "coverAssetId";
    public static final String CLEAR_COVER_ASSET = "clearCoverAsset";
    public static final String AUDIO_ASSET_ID = "audioAssetId";
    public static final String DURATION_SECONDS = "durationSeconds";
    public static final String EPISODE_NUMBER = "episodeNumber";
    public static final String ACCESS_POLICY = "accessPolicy";
    public static final String REQUIRED_LEVEL_SORT_ORDER = "requiredLevelSortOrder";
    public static final String CATEGORY_IDS = "categoryIds";
    public static final String NEWSLETTER_LIST_IDS = "newsletterListIds";
    public static final String FORMAT_IDS = "formatIds";

    private WorkingDraftMaps() {
    }

    public static boolean isPresent(Map<String, Object> draft) {
        return draft != null && !draft.isEmpty();
    }

    public static Map<String, Object> mutableCopy(Map<String, Object> draft) {
        if (draft == null || draft.isEmpty()) {
            return new LinkedHashMap<>();
        }
        return new LinkedHashMap<>(draft);
    }

    public static void putString(Map<String, Object> draft, String key, String value) {
        draft.put(key, value);
    }

    public static void putNullableLong(Map<String, Object> draft, String key, Long value) {
        draft.put(key, value);
    }

    public static void putBoolean(Map<String, Object> draft, String key, boolean value) {
        draft.put(key, value);
    }

    public static void putInteger(Map<String, Object> draft, String key, Integer value) {
        draft.put(key, value);
    }

    public static void putLongList(Map<String, Object> draft, String key, List<Long> values) {
        draft.put(key, values == null ? List.of() : List.copyOf(values));
    }

    public static String getString(Map<String, Object> draft, String key) {
        Object value = draft.get(key);
        return value == null ? null : String.valueOf(value);
    }

    public static Long getLong(Map<String, Object> draft, String key) {
        Object value = draft.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Long.parseLong(text.trim());
        }
        return null;
    }

    public static Integer getInteger(Map<String, Object> draft, String key) {
        Object value = draft.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Integer.parseInt(text.trim());
        }
        return null;
    }

    public static boolean getBoolean(Map<String, Object> draft, String key, boolean defaultValue) {
        Object value = draft.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    public static boolean containsKey(Map<String, Object> draft, String key) {
        return draft != null && draft.containsKey(key);
    }

    @SuppressWarnings("unchecked")
    public static List<Long> getLongList(Map<String, Object> draft, String key) {
        Object value = draft.get(key);
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List<?> raw)) {
            throw new IllegalArgumentException(key + " must be a list of ids");
        }
        List<Long> ids = new ArrayList<>(raw.size());
        for (Object item : raw) {
            if (item == null) {
                continue;
            }
            if (item instanceof Number number) {
                ids.add(number.longValue());
            } else {
                ids.add(Long.parseLong(String.valueOf(item).trim()));
            }
        }
        return List.copyOf(ids);
    }
}
