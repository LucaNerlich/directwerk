package de.pnnit.directwerk.modules.digital.api;

/**
 * What happens to a folder's contents when the folder itself is deleted.
 */
public enum FolderDeleteMode {

    /** Assets and subfolders move up to the deleted folder's parent (or root). */
    MOVE_TO_PARENT,

    /** Contained assets are deleted (via the asset lifecycle) and subfolders removed. */
    DELETE_CONTENTS;

    /**
     * Parses the {@code mode} query parameter. Unknown values are rejected with
     * {@link IllegalArgumentException}, which the API maps to {@code 400 VALIDATION_ERROR}.
     */
    public static FolderDeleteMode parse(String raw) {
        if (raw == null || raw.equalsIgnoreCase("move_to_parent")) {
            return MOVE_TO_PARENT;
        }
        if (raw.equalsIgnoreCase("delete_contents")) {
            return DELETE_CONTENTS;
        }
        throw new IllegalArgumentException(
                "Unknown folder delete mode: " + raw + " (expected move_to_parent or delete_contents)");
    }
}
