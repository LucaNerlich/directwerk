package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when a media folder cannot be found in the current tenant scope.
 */
public class MediaFolderNotFoundException extends RuntimeException {

    public MediaFolderNotFoundException(Long folderId) {
        super("Media folder not found: " + folderId);
    }
}
