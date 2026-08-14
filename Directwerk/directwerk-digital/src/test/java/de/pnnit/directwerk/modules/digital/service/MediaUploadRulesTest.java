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
}
