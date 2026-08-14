package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when object storage is required but not configured/enabled.
 */
public class StorageNotConfiguredException extends RuntimeException {

    public StorageNotConfiguredException(String message) {
        super(message);
    }
}
