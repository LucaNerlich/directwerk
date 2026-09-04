package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.CreateUploadUrlRequest;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import org.springframework.stereotype.Component;

@Component
public class MediaUploadCommandMapper {

    public UploadApi.CreateUploadUrlCommand toCommand(CreateUploadUrlRequest request) {
        return new UploadApi.CreateUploadUrlCommand(
                request.filename(),
                request.mimeType(),
                request.sizeBytes(),
                request.assetType(),
                request.intendedVisibility(),
                request.scope(),
                request.episodeId(),
                request.ownerUserId(),
                request.folderId()
        );
    }
}
