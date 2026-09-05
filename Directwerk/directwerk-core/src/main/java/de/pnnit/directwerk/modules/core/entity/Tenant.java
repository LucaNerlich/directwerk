package de.pnnit.directwerk.modules.core.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tenants")
@Getter
@Setter
public class Tenant extends BaseEntity {

    @Column(nullable = false, unique = true, length = 64)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TenantStatus status = TenantStatus.ACTIVE;

    /**
     * Per-asset-type upload size overrides in bytes. {@code null} means "platform
     * default" (see {@code MediaUploadRules}); bounds are validated in
     * {@code TenantUploadLimits} before persistence.
     */
    @Column(name = "max_audio_bytes")
    private Long maxAudioBytes;

    @Column(name = "max_image_bytes")
    private Long maxImageBytes;

    @Column(name = "max_video_bytes")
    private Long maxVideoBytes;

    @Column(name = "max_document_bytes")
    private Long maxDocumentBytes;

    /**
     * Single definition of "tenant may serve traffic" — used by resolution, filters and
     * registration alike so new statuses cannot silently diverge the checks.
     */
    public boolean isActive() {
        return status == TenantStatus.ACTIVE;
    }
}
