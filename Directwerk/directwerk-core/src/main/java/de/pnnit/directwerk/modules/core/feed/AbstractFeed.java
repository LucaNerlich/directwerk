package de.pnnit.directwerk.modules.core.feed;

import de.pnnit.directwerk.modules.core.entity.BaseEntity;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.multitenancy.TenantOwned;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;

/**
 * State shared by every private content feed, whatever it publishes.
 *
 * <p>Podcast feeds and article feeds own separate tables (their custom-feed filter
 * points at formats or categories), but the owner, the encrypted bearer token, the
 * blind index, the title and the enabled/default flags are identical. Keeping them
 * here means a token or tenancy fix lands in both tables at once; each module entity
 * declares only its table and its content association.</p>
 */
@MappedSuperclass
@Getter
@Setter
public abstract class AbstractFeed extends BaseEntity implements TenantOwned {

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

    @PrePersist
    @PreUpdate
    void mirrorHashToLegacyTokenColumn() {
        legacyFeedToken = feedTokenHash;
    }
}
