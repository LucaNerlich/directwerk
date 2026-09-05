package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import de.pnnit.directwerk.multitenancy.TenantWriteGuardListener;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Entity
@Table(name = "subscriber_feeds")
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class SubscriberFeed extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "feed_token_protected", nullable = false, length = 255)
    /**
     * AES-256-GCM ciphertext of the bearer token (see {@code FeedTokenProtector}).
     * Raw tokens must stay recoverable server-side for snapshot enclosure URLs,
     * so lookups use the {@code feed_token_hash} blind index instead.
     */
    private String feedToken;

    @Column(name = "feed_token_hash", nullable = false, unique = true, length = 64)
    private String feedTokenHash;

    @Column(name = "feed_token", nullable = false, length = 64)
    private String legacyFeedToken;

    @Column(nullable = false)
    private String title;

    @Column(name = "is_default", nullable = false)
    private boolean defaultFeed = true;

    /** When false, the private feed XML and all tokenized enclosure URLs return 404. */
    @Column(nullable = false)
    private boolean enabled = true;

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

    @PrePersist
    @PreUpdate
    void mirrorHashToLegacyTokenColumn() {
        legacyFeedToken = feedTokenHash;
    }
}
