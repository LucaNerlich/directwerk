package de.pnnit.directwerk.modules.content;

/**
 * An action a caller may take on publishable content. The values are the API
 * vocabulary exposed as {@code availableActions}; they are not permissions.
 */
public enum LifecycleAction {
    EDIT,
    PUBLISH,
    SCHEDULE,
    CANCEL_SCHEDULE,
    UNPUBLISH,
    ARCHIVE,
    UNARCHIVE,
    DISCARD_DRAFT,
    NOTIFY,
    DELETE
}
