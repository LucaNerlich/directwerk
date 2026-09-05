package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import org.junit.jupiter.api.Test;

class MediaUploadRulesTest {

    @Test
    void acceptsAllowedAudioMimeAndSize() {
        MediaUploadRules.validateMimeAndSize(AssetType.AUDIO, "audio/mpeg", 1024);
    }

    @Test
    void rejectsDisallowedMime() {
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(AssetType.IMAGE, "application/pdf", 100))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsOversizedImage() {
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(
                AssetType.IMAGE, "image/jpeg", 11L * 1024 * 1024
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void allowsLargeAudioWithinFiveGigabyteLimit() {
        MediaUploadRules.validateMimeAndSize(AssetType.AUDIO, "audio/mpeg", 5L * 1024 * 1024 * 1024);
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(
                AssetType.AUDIO, "audio/mpeg", 5L * 1024 * 1024 * 1024 + 1
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void allowsLargeVideoWithinFiveGigabyteLimit() {
        MediaUploadRules.validateMimeAndSize(AssetType.VIDEO, "video/mp4", 5L * 1024 * 1024 * 1024);
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(
                AssetType.VIDEO, "video/mp4", 5L * 1024 * 1024 * 1024 + 1
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void resolvesTenantOverrideFromEntity() {
        Tenant tenant = new Tenant();
        tenant.setMaxImageBytes(20L * 1024 * 1024);
        assertThat(MediaUploadRules.limitOverride(tenant, AssetType.IMAGE)).isEqualTo(20L * 1024 * 1024);
        assertThat(MediaUploadRules.limitOverride(tenant, AssetType.AUDIO)).isNull();
        assertThat(MediaUploadRules.limitOverride(null, AssetType.AUDIO)).isNull();
    }

    @Test
    void enforcesLoweredTenantOverride() {
        MediaUploadRules.validateMimeAndSize(AssetType.IMAGE, "image/jpeg", 4L * 1024 * 1024, 5L * 1024 * 1024);
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(
                AssetType.IMAGE, "image/jpeg", 10L * 1024 * 1024, 5L * 1024 * 1024
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void enforcesRaisedTenantOverride() {
        MediaUploadRules.validateMimeAndSize(AssetType.IMAGE, "image/jpeg", 20L * 1024 * 1024, 25L * 1024 * 1024);
        assertThatThrownBy(() -> MediaUploadRules.validateMimeAndSize(
                AssetType.IMAGE, "image/jpeg", 26L * 1024 * 1024, 25L * 1024 * 1024
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsOutOfRangeOverride() {
        assertThat(MediaUploadRules.effectiveMaxBytes(AssetType.AUDIO, null))
                .isEqualTo(MediaUploadRules.maxBytes(AssetType.AUDIO));
        assertThatThrownBy(() -> MediaUploadRules.effectiveMaxBytes(AssetType.AUDIO, 0L))
                .isInstanceOf(UploadValidationException.class);
        assertThatThrownBy(() -> MediaUploadRules.effectiveMaxBytes(
                AssetType.AUDIO, 6L * 1024 * 1024 * 1024
        )).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void mapsMimeToCanonicalExtension() {
        assertThat(MediaUploadRules.extensionForMime("audio/mpeg")).isEqualTo("mp3");
        assertThat(MediaUploadRules.extensionForMime("audio/mp4")).isEqualTo("m4a");
        assertThat(MediaUploadRules.extensionForMime("audio/x-m4a")).isEqualTo("m4a");
        assertThat(MediaUploadRules.extensionForMime("audio/wav")).isEqualTo("wav");
        assertThat(MediaUploadRules.extensionForMime("image/jpeg")).isEqualTo("jpg");
        assertThat(MediaUploadRules.extensionForMime("image/png")).isEqualTo("png");
        assertThat(MediaUploadRules.extensionForMime("video/mp4")).isEqualTo("mp4");
        assertThat(MediaUploadRules.extensionForMime("video/webm")).isEqualTo("webm");
        assertThat(MediaUploadRules.extensionForMime("application/pdf")).isEqualTo("pdf");
        assertThat(MediaUploadRules.extensionForMime("audio/mp3")).isEqualTo("mp3");
        assertThat(MediaUploadRules.extensionForMime("application/octet-stream")).isNull();
        assertThat(MediaUploadRules.extensionForMime(null)).isNull();
    }

    @Test
    void sanitizesFilename() {
        assertThat(MediaUploadRules.sanitizeFilename("../../evil name!!.mp3"))
                .isEqualTo("evil_name_.mp3");
    }

    @Test
    void sanitizesFilenameStem() {
        assertThat(MediaUploadRules.sanitizeFilenameStem("episode 42.mp3"))
                .isEqualTo("episode_42");
    }

    @Test
    void sanitizesFilenameStemWithSpecialCharacters() {
        assertThat(MediaUploadRules.sanitizeFilenameStem("cover art#1.png"))
                .isEqualTo("cover_art_1");
    }

    @Test
    void sanitizesFilenameStemWithoutExtension() {
        assertThat(MediaUploadRules.sanitizeFilenameStem("readme"))
                .isEqualTo("readme");
    }

    @Test
    void infersMimeFromFilename() {
        assertThat(MediaUploadRules.inferMimeFromFilename(AssetType.AUDIO, "show.mp3"))
                .isEqualTo("audio/mpeg");
        assertThat(MediaUploadRules.inferMimeFromFilename(AssetType.IMAGE, "cover.JPG"))
                .isEqualTo("image/jpeg");
        assertThat(MediaUploadRules.normalizeMime("audio/mp3; charset=binary"))
                .isEqualTo("audio/mpeg");
    }

    @Test
    void capsOverlongFilenameStem() {
        String longName = "a".repeat(150) + ".mp3";
        assertThat(MediaUploadRules.sanitizeFilenameStem(longName))
                .isEqualTo("a".repeat(100));
    }

    @Test
    void mapsAssetTypesToDefaultExtensions() {
        assertThat(MediaUploadRules.defaultExtensionForType(AssetType.AUDIO)).isEqualTo("mp3");
        assertThat(MediaUploadRules.defaultExtensionForType(AssetType.IMAGE)).isEqualTo("jpg");
        assertThat(MediaUploadRules.defaultExtensionForType(AssetType.VIDEO)).isEqualTo("mp4");
        assertThat(MediaUploadRules.defaultExtensionForType(AssetType.DOCUMENT)).isEqualTo("pdf");
    }

    @Test
    void ensuresUsableExtensionForExtensionlessFilename() {
        assertThat(MediaUploadRules.ensureUsableExtension("download", AssetType.AUDIO))
                .isEqualTo("download.mp3");
        assertThat(MediaUploadRules.ensureUsableExtension("download", AssetType.DOCUMENT))
                .isEqualTo("download.pdf");
    }

    @Test
    void keepsRealExtensionUnchanged() {
        assertThat(MediaUploadRules.ensureUsableExtension("foo.mp3", AssetType.AUDIO))
                .isEqualTo("foo.mp3");
    }

    @Test
    void replacesBinExtensionWithTypeDefault() {
        assertThat(MediaUploadRules.ensureUsableExtension("import.bin", AssetType.AUDIO))
                .isEqualTo("import.mp3");
    }

    @Test
    void rejectsDotOnlyFilename() {
        assertThatThrownBy(() -> MediaUploadRules.sanitizeFilename("."))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void detectsGenericFilenameStems() {
        assertThat(MediaUploadRules.isGenericFilenameStem("download")).isTrue();
        assertThat(MediaUploadRules.isGenericFilenameStem(" Download ")).isTrue();
        assertThat(MediaUploadRules.isGenericFilenameStem("EPISODE")).isTrue();
        assertThat(MediaUploadRules.isGenericFilenameStem("folge-1")).isFalse();
        assertThat(MediaUploadRules.isGenericFilenameStem("my-show-ep12")).isFalse();
        assertThat(MediaUploadRules.isGenericFilenameStem(null)).isFalse();
    }
}
