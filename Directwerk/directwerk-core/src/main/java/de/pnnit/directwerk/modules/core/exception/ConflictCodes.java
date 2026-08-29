package de.pnnit.directwerk.modules.core.exception;

/**
 * API error codes for resource-uniqueness conflicts thrown as {@link ConflictException}.
 * One home so service throws and integration tests reference identical strings.
 */
public final class ConflictCodes {

    private ConflictCodes() {
    }

    public static final String TENANT_SLUG_EXISTS = "TENANT_SLUG_EXISTS";
    public static final String SERIES_SLUG_EXISTS = "SERIES_SLUG_EXISTS";
    public static final String EPISODE_SLUG_EXISTS = "EPISODE_SLUG_EXISTS";
    public static final String EPISODE_IMPORT_GUID_EXISTS = "EPISODE_IMPORT_GUID_EXISTS";
    public static final String FORMAT_SLUG_EXISTS = "FORMAT_SLUG_EXISTS";
    public static final String CATEGORY_SLUG_EXISTS = "CATEGORY_SLUG_EXISTS";
    public static final String ARTICLE_SLUG_EXISTS = "ARTICLE_SLUG_EXISTS";
    public static final String PRODUCT_SLUG_EXISTS = "PRODUCT_SLUG_EXISTS";
    public static final String USER_EXISTS = "USER_EXISTS";
    public static final String USER_ALREADY_MEMBER = "USER_ALREADY_MEMBER";
    public static final String INVALID_MEMBERSHIP_STATE = "INVALID_MEMBERSHIP_STATE";
}
