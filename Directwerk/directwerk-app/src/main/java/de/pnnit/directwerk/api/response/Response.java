package de.pnnit.directwerk.api.response;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public record Response<T>(
        int statusCode,
        String statusMessage,
        T data,
        List<ErrorDetail> errors,
        Map<String, Object> metadata
) {

    /**
     * Creates a successful response with the specified data.
     *
     * @param <T>   the response data type
     * @param data  the response data
     * @return      a response with status code 200 and no errors or metadata
     */
    public static <T> Response<T> ok(T data) {
        return new Response<>(200, "OK", data, List.of(), Map.of());
    }

    /**
     * Creates a successful response containing data and metadata.
     *
     * @param data     the response data
     * @param metadata the response metadata; {@code null} is treated as an empty map
     * @param <T>      the response data type
     * @return a successful response with status code {@code 200}
     */
    public static <T> Response<T> ok(T data, Map<String, Object> metadata) {
        return new Response<>(200, "OK", data, List.of(), metadata == null ? Map.of() : Map.copyOf(metadata));
    }

    /**
     * Creates a response indicating that a resource was created.
     *
     * @param data the created resource
     * @param <T> the response data type
     * @return a response with status code 201 and the created resource
     */
    public static <T> Response<T> created(T data) {
        return new Response<>(201, "Created", data, List.of(), Map.of());
    }

    public static <T> Response<T> accepted(T data) {
        return new Response<>(202, "Accepted", data, List.of(), Map.of());
    }

    public static <T> Response<T> error(int statusCode, String statusMessage, List<ErrorDetail> errors) {
        return new Response<>(statusCode, statusMessage, null, errors, Map.of());
    }

    public static <T> Response<T> error(int statusCode, String code, String message) {
        return error(statusCode, code, List.of(new ErrorDetail(code, message, null)));
    }

    public static Response<Void> emptyOk() {
        return new Response<>(200, "OK", null, Collections.emptyList(), Map.of());
    }
}
