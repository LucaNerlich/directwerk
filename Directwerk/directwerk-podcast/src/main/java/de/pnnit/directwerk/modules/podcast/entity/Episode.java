package de.pnnit.directwerk.modules.podcast.entity;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import de.pnnit.directwerk.multitenancy.TenantWriteGuardListener;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Entity
@Table(
        name = "episodes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "slug"})
)
@EntityListeners(TenantWriteGuardListener.class)
@Filter(name = TenantFilters.FILTER_NAME, condition = TenantFilters.CONDITION)
@Getter
@Setter
public class Episode extends BaseEntity implements TenantOwned {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "series_id", nullable = false)
    private PodcastSeries series;

    @Column(name = "episode_number")
    private Integer episodeNumber;

    @Column(nullable = false, length = 64)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audio_asset_id")
    private MediaAsset audioAsset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_asset_id")
    private MediaAsset coverAsset;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_policy", nullable = false, length = 16)
    private AccessPolicy accessPolicy = AccessPolicy.FREE;

    @Column(name = "required_level_sort_order")
    private Integer requiredLevelSortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EpisodeStatus status = EpisodeStatus.DRAFT;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "email_notified_at")
    private Instant emailNotifiedAt;

    @Column(name = "notify_subscribers_on_publish", nullable = false)
    private boolean notifySubscribersOnPublish = false;

    /**
     * When false, stable public/private enclosure proxy URLs return 404 and the episode
     * is omitted from RSS feeds.
     */
    @Column(name = "enclosure_enabled", nullable = false)
    private boolean enclosureEnabled = true;

    @ManyToMany
    @JoinTable(
            name = "episode_formats",
            joinColumns = @JoinColumn(name = "episode_id"),
            inverseJoinColumns = @JoinColumn(name = "format_id")
    )
    private Set<Format> formats = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(
            name = "episode_categories",
            joinColumns = @JoinColumn(name = "episode_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private Set<Category> categories = new LinkedHashSet<>();
}
