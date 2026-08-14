# directwerk-digital

Digital content / asset storage (`DIGITAL_CONTENT`) — upload, access, and S3 foundation.

## Contents

| Package | Description |
|---------|-------------|
| `modules.digital.api` | `AssetAccessApi`, `EntitlementApi`, `MediaAssetQueryApi`, `UploadApi`, `MediaAssetLifecycleApi`, `CdnPurgeClient` |
| `modules.digital.entity` | `MediaAsset` and storage enums |
| `modules.digital.repository` | `MediaAssetRepository` |
| `modules.digital.service` | `UploadService`, `MediaAssetLifecycleService`, `AssetAccessService`, query + fail-closed entitlement |
| `modules.digital.storage` | S3 client beans, public URL builder, Bunny CDN purge |

## HTTP (in `directwerk-app`)

| Method | Path | Role |
|--------|------|------|
| POST | `/api/v1/media/upload-url` | EDITOR / TENANT_ADMIN |
| POST | `/api/v1/media/{id}/confirm` | EDITOR / TENANT_ADMIN |
| GET | `/api/v1/media` | EDITOR / TENANT_ADMIN |
| GET | `/api/v1/media/{id}` | EDITOR / TENANT_ADMIN |
| GET | `/api/v1/media/{id}/preview-url` | EDITOR / TENANT_ADMIN |
| DELETE | `/api/v1/media/{id}` | EDITOR / TENANT_ADMIN (ownership for `USER` scope) |
| DELETE | `/api/v1/platform/tenants/{tenantId}/media/{assetId}` | PLATFORM_ADMIN |

DELETE removes the S3 object via the `media-s3-delete` queue, then purges the public
CDN URL via `media-cdn-purge` when configured (`directwerk.storage.cdn-purge-api-key`).
The API marks the row `PENDING_DELETE` immediately; workers tombstone as `ARCHIVED`
(non-restorable). Private downloads use short-lived pre-signed GET after entitlement
(or editor preview bypass).

Enable with `directwerk.storage.enabled=true` and S3/Bunny credentials.

Flyway: `V25` media_assets, `V26` upload metadata columns.

## Build

```sh
./gradlew :directwerk-digital:build
./gradlew :directwerk-app:test --tests "*Media*" --tests "*Upload*" --tests "*AssetAccess*" --tests "*Lifecycle*" --tests "*CdnPurge*" --tests "*MediaS3*" --tests "*MediaCdn*"
```
