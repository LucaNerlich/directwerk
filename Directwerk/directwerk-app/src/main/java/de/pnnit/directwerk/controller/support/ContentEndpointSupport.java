package de.pnnit.directwerk.controller.support;

import de.pnnit.directwerk.api.dto.PublishOptionsRequest;
import de.pnnit.directwerk.api.response.Response;
import java.time.Instant;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Response shapes shared by the content controllers.
 *
 * <p>Episode and article endpoints differ in their entities and views, but every
 * handler resolves a tenant and wraps its result the same way. Keeping that wrapper
 * here means the duplicated controller bodies are one-line delegations and a change
 * to the response envelope lands in both content types at once.</p>
 */
public final class ContentEndpointSupport {

    private ContentEndpointSupport() {
    }

    /**
     * Wraps one entity through its view mapper.
     *
     * @param entity the entity
     * @param mapper the entity-to-view mapper
     * @param <E>    the entity type
     * @param <V>    the view type
     * @return the 200 response
     */
    public static <E, V> ResponseEntity<Response<V>> ok(E entity, Function<E, V> mapper) {
        return ResponseEntity.ok(Response.ok(mapper.apply(entity)));
    }

    /**
     * Wraps one view.
     *
     * @param view the view
     * @param <V>  the view type
     * @return the 200 response
     */
    public static <V> ResponseEntity<Response<V>> ok(V view) {
        return ResponseEntity.ok(Response.ok(view));
    }

    /**
     * Wraps a list of entities through their view mapper.
     *
     * @param entities the entities
     * @param mapper   the entity-to-view mapper
     * @param <E>      the entity type
     * @param <V>      the view type
     * @return the 200 response
     */
    public static <E, V> ResponseEntity<Response<List<V>>> okList(
            List<E> entities,
            Function<E, V> mapper
    ) {
        return ResponseEntity.ok(Response.ok(entities.stream().map(mapper).toList()));
    }

    /**
     * Wraps a list of views.
     *
     * @param views the views
     * @param <V>   the view type
     * @return the 200 response
     */
    public static <V> ResponseEntity<Response<List<V>>> okList(List<V> views) {
        return ResponseEntity.ok(Response.ok(views));
    }

    /**
     * Wraps a just-created view.
     *
     * @param view the created view
     * @param <V>  the view type
     * @return the 201 response
     */
    public static <V> ResponseEntity<Response<V>> created(V view) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(view));
    }

    /**
     * Wraps a just-created entity through its view mapper.
     *
     * @param entity the created entity
     * @param mapper the entity-to-view mapper
     * @param <E>    the entity type
     * @param <V>    the view type
     * @return the 201 response
     */
    public static <E, V> ResponseEntity<Response<V>> created(E entity, Function<E, V> mapper) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(mapper.apply(entity)));
    }

    /**
     * Resolves the publish options and wraps the published entity.
     *
     * <p>{@code POST /publish} accepts an optional body; a missing body means "publish now
     * without notifying subscribers". Both content types share that rule.</p>
     *
     * @param options   the optional publish body
     * @param publisher the publish call taking (notifySubscribers, publishedAt)
     * @param mapper    the entity-to-view mapper
     * @param <E>       the entity type
     * @param <V>       the view type
     * @return the 200 response
     */
    public static <E, V> ResponseEntity<Response<V>> publish(
            PublishOptionsRequest options,
            BiFunction<Boolean, Instant, E> publisher,
            Function<E, V> mapper
    ) {
        boolean notifySubscribers = options != null && Boolean.TRUE.equals(options.notifySubscribers());
        Instant publishedAt = options != null ? options.publishedAt() : null;
        return ok(publisher.apply(notifySubscribers, publishedAt), mapper);
    }

    /**
     * Resolves a bulk request's notification flag.
     *
     * @param notifySubscribers the request flag, possibly {@code null}
     * @return whether subscribers should be notified
     */
    public static boolean notifySubscribers(Boolean notifySubscribers) {
        return Boolean.TRUE.equals(notifySubscribers);
    }
}
