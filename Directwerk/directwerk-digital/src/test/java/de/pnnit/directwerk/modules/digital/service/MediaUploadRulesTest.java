package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
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
}
