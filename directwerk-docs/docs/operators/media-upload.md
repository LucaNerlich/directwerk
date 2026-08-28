---
title: Media upload
description: Presigned upload, confirm, and read — operator how-to for tenant media assets.
outline: deep
---

<!-- source: Directwerk/docs/media-upload-howto.md -->

Design details: [Asset storage](/architecture/asset-storage). HTTP harness: `Directwerk/http/17-media-upload.http`.

**Roles:** `EDITOR` or `TENANT_ADMIN`, plus tenant module `DIGITAL_CONTENT`.  
**Auth:** JWT on the tenant `Host` (same as other `/api/v1/**` routes).

---

## 1. Enable object storage

Set credentials in `Directwerk/.env` (Hetzner or Bunny S3 mode). Bunny reference:
[docs.bunny.net/storage/s3](https://docs.bunny.net/storage/s3).

```ini
DIRECTWERK_STORAGE_ENABLED=true
DIRECTWERK_STORAGE_PROVIDER=bunny
DIRECTWERK_STORAGE_REGION=de
DIRECTWERK_STORAGE_ENDPOINT=https://de-s3.storage.bunnycdn.com
DIRECTWERK_STORAGE_FORCE_PATH_STYLE=true
DIRECTWERK_STORAGE_BUCKET=your-zone-name
DIRECTWERK_STORAGE_ACCESS_KEY=your-zone-name
DIRECTWERK_STORAGE_SECRET_KEY=your-zone-password
DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL=https://your-pullzone.b-cdn.net
DIRECTWERK_STORAGE_PRIVATE_CDN_BASE_URL=https://your-private-pullzone.b-cdn.net
DIRECTWERK_STORAGE_CDN_TOKEN_AUTH_KEY=your-private-pz-token-auth-key
```

Public PZ must edge-block `*/private/*`, `*/staging/*`, `*/user/*`. Private PZ + Token Auth
is required for paid downloads via Bunny Advanced tokens (otherwise S3 presign fallback).

`DIRECTWERK_STORAGE_ENABLED=true` is required — Bunny path-style / endpoint vars alone do
not wire `UploadApi`. Use Bunny's region code (`de`, `uk`, `se`, …) — not
`eu-central-1`. For Hetzner, use `provider=hetzner`, `force-path-style=false`, and your
`https://{location}.your-objectstorage.com` endpoint. Full variable list: `Directwerk/.env.example`.

Restart the API. With storage enabled, `/actuator/health` can report the S3 indicator.

---

## 2. Request a pre-signed upload URL

```http
POST /api/v1/media/upload-url
Authorization: Bearer <tenant-jwt>
Host: <tenant-host>
Content-Type: application/json

{
  "filename": "cover.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1024,
  "assetType": "IMAGE",
  "intendedVisibility": "PUBLIC",
  "scope": "TENANT_PUBLIC"
}
```

Response (`201`) includes `assetId`, `uploadUrl`, `expiresAt`, and `headers` (e.g. `Content-Type`).
The asset is created as `PENDING` under `{tenant_slug}/staging/...`.

Private audio example: `"assetType": "AUDIO"`, `"intendedVisibility": "PRIVATE"`,
`"scope": "CONTENT"`, `"mimeType": "audio/mpeg"`.

---

## 3. PUT the file to object storage

Upload bytes **directly to S3/Bunny** — not through the Spring API:

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @cover.jpg
```

Use the exact `Content-Type` from the `headers` map. Size must match `sizeBytes`
(validated on confirm via `HeadObject`). Presigned PUTs intentionally **do not**
sign `Content-Length` — browsers cannot set that header reliably.

**Bunny note:** Per [Bunny S3 known limitations](https://docs.bunny.net/storage/s3#known-limitations),
CORS must be handled at the CDN level — the storage S3 endpoint does **not** emit CORS headers.
Browser PUTs to `https://{region}-s3.storage.bunnycdn.com/...` fail with no Spring logs.
directwerk-admin therefore proxies the PUT through
`POST /api/tenants/{id}/media/upload`. For curl/harness tests, PUT from the
same machine as usual.

---

## 4. Confirm and promote

```http
POST /api/v1/media/{assetId}/confirm
Authorization: Bearer <tenant-jwt>
Host: <tenant-host>
```

The API HEADs the staging object, copies it to the final key, deletes staging, and sets status
`READY`:

- Public → `{tenant_slug}/public/{type}/{uuid}.{ext}`
- Private → `{tenant_slug}/private/{type}/{uuid}.{ext}`

If the PUT never happened, confirm returns `400 UPLOAD_VALIDATION_FAILED`.

---

## 5. Read the asset

| Visibility | How to get a URL |
|------------|------------------|
| **Public** | CDN: `{PUBLIC_CDN_BASE_URL}/{s3_key}` (also via `AssetAccessApi.resolveDownloadUrl`) |
| **Private (publisher)** | `GET /api/v1/media/{id}/preview-url?previewDraft=true` — short-lived pre-signed GET |
| **Private (subscriber)** | `AssetAccessApi.resolveDownloadUrl` after current LEVEL/PACKAGE entitlement checks; fail-closed if no entitlement adapter is wired |

List / inspect metadata:

```http
GET /api/v1/media?limit=20
GET /api/v1/media/{id}
```

Never log pre-signed URLs. Never give clients prefix-wide S3 credentials or `ListObjects`.
