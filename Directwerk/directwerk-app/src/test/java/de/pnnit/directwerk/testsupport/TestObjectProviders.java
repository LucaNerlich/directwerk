package de.pnnit.directwerk.testsupport;

import org.springframework.beans.factory.ObjectProvider;

public final class TestObjectProviders {

    private TestObjectProviders() {}

    public static <T> ObjectProvider<T> returning(T value) {
        return new ObjectProvider<>() {
            @Override
            public T getObject() {
                return value;
            }

            @Override
            public T getIfAvailable() {
                return value;
            }
        };
    }

    public static <T> ObjectProvider<T> empty() {
        return new ObjectProvider<>() {
            @Override
            public T getObject() {
                throw new IllegalStateException("No bean available");
            }

            @Override
            public T getIfAvailable() {
                return null;
            }
        };
    }
}
