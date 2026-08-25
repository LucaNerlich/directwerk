# CLAUDE.md

## Commands

```sh
./gradlew :directwerk-digital:build
./gradlew :directwerk-app:test --tests "*MediaAsset*" --tests "*AssetAccess*"
```

## Architecture

Optional digital-content / object-storage foundation for `DIGITAL_CONTENT`. Depends on
`directwerk-core`. Wired into `directwerk-app`; no media REST controllers in alpha.

- `modules.digital.api` — storage-facing contracts (`AssetAccessApi`, `EntitlementApi`,
  `MediaAssetQueryApi`, `UploadApi`, `MediaAssetLifecycleApi`, `CdnPurgeClient`)
- `modules.digital.entity` — `MediaAsset` (`TenantOwned` + Hibernate `tenantFilter`)
- `modules.digital.service` — `AssetAccessService` (public CDN only; private fail-closed),
  `UploadService`, `MediaAssetLifecycleService` (authorize + `PENDING_DELETE` + enqueue),
  `FailClosedEntitlementApi`, `MediaAssetQueryService`
- `modules.digital.job` — `media-s3-delete` / `media-cdn-purge` / `media-staging-cleanup`
  producers and handlers, plus the `MediaStagingCleanupJob` Quartz trigger and
  `StagingCleanupService` (staging file + session-folder deletion and expired-staging sweep)
- `modules.digital.config` — `MediaQuartzConfig` (schedules the staging cleanup sweep)
- `modules.digital.storage` — conditional `S3Client` / `S3Presigner` when
  `directwerk.storage.enabled=true`, `S3PublicUrlBuilder`, `BunnyCdnPurgeClient` (optional
  Purge URL via `cdn-purge-api-key`)

Flyway owns `media_assets` in `directwerk-app`.
