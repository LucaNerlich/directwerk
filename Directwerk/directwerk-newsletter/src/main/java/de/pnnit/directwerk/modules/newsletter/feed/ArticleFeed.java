package de.pnnit.directwerk.modules.newsletter.feed;

import de.pnnit.directwerk.modules.core.feed.AbstractFeed;
import de.pnnit.directwerk.modules.digital.entity.Category;
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
 * A subscriber's private article feed. Owner, token and visibility state live in
 * {@link AbstractFeed}; this entity adds the category filter a custom feed selects.
 */
@Entity
@Table(name = "article_feeds")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class ArticleFeed extends AbstractFeed {

    /**
     * Categories included in a custom feed. Empty on the default feed (all entitled articles).
     * Custom feeds require at least one category.
     */
    @ManyToMany
    @JoinTable(
            name = "article_feed_categories",
            joinColumns = @JoinColumn(name = "feed_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private Set<Category> categories = new LinkedHashSet<>();
}
