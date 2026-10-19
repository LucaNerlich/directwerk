package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.core.feed.AbstractFeed;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantWriteGuardListener;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

/**
 * A subscriber's private podcast feed. Owner, token and visibility state live in
 * {@link AbstractFeed}; this entity adds the format filter a custom feed selects.
 */
@Entity
@Table(name = "subscriber_feeds")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class SubscriberFeed extends AbstractFeed {

    /**
     * Formate included in a custom feed. Empty on the default feed (all entitled episodes).
     * Custom feeds require at least one format.
     */
    @ManyToMany
    @JoinTable(
            name = "subscriber_feed_formats",
            joinColumns = @JoinColumn(name = "feed_id"),
            inverseJoinColumns = @JoinColumn(name = "format_id")
    )
    private Set<Format> formats = new LinkedHashSet<>();
}
