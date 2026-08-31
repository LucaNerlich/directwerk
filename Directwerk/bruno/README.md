# Directwerk API — Bruno collection

A [Bruno](https://www.usebruno.com) collection covering the full Directwerk REST surface. Built directly
from the controllers under `directwerk-app/src/main/java/de/pnnit/directwerk/controller/**` and
cross-checked against the manual test harness at [`../http/*.http`](../http/00-index.http); folders mirror
that harness's dependency order.

**Maintenance rule:** this collection does not regenerate from code. Update it on/after every controller or
API change — new endpoints, changed request/response shapes, new error codes, renamed routes — in the same
change as the controller, alongside [`../http/*.http`](../http/00-index.http).

## Setup

1. Install the [Bruno app](https://www.usebruno.com) (or use `npx @usebruno/cli`).
2. Open this `bruno/` folder as a collection.
3. Start the API from `Directwerk/`: `docker compose up -d && ./gradlew :directwerk-app:bootRun` (see
   [`../docs/build-and-deploy.md`](../docs/build-and-deploy.md)).
4. Select the **local** environment in Bruno.
5. Open the environment and fill in the four `vars:secret` values (`platformClientSecret`,
   `oauthClientSecret`, `platformAdminPassword`, `seedPassword`) from your `Directwerk/.env`. Bruno stores
   these encrypted on your machine (OS keychain, or AES256 as a fallback) — outside git, never written back
   into these committed `.bru` files, and persisted across restarts so you only type them once.
6. If your `.env` sets a custom `DIRECTWERK_DEV_PLATFORM_ADMIN_EMAIL`, update `platformAdminEmail` in the
   environment to match (the collection default is the documented default,
   `platform-admin@directwerk.local`).

## Running it

Run **01-Auth-and-Tokens** top to bottom first — it logs in as every seeded persona and captures the
resulting access/refresh tokens as runtime variables (`platformAccessToken`, `tenantAAccessToken`,
`editorAccessToken`, `subscriberAccessToken`, `tenantBAccessToken`) via `bru.setVar()`/`bru.deleteVar()`
(not the plain `vars:post-response` shorthand — these are sensitive, so they get explicit script handling).
After that, explore folders 02–11 in any order: each folder's `folder.bru` declares `auth: bearer` with the
token its endpoints need, and every request uses `auth: inherit`.

**Self-registered subscribers must verify their email before they can log in** — a `PENDING_VERIFICATION`
account fails the OAuth2 password grant with a bare `invalid_grant`, which looks exactly like a wrong
password but isn't one. The flow is: **5 - Register** → **6 - Auto-Verify Email (Mailpit, local only)** →
**7 - Tenant A Subscriber Login**. Step 6 is a deliberate local-only convenience: it reads the real
verification email back out of Mailpit (`http://127.0.0.1:8025`, part of the docker-compose stack) and
calls `verify-email` with the real token — it's automating what you'd otherwise copy-paste from the same
email by hand, not bypassing verification. It refuses to run (clear error, before any network call) against
any environment without a `mailpitUrl` var, which is deliberately only defined in **local**. Against a
deployed environment, use **13 - Verify Email** instead: check your real inbox for the "Verify your email
address" message, copy the token out of its link's `?token=` query param, paste it into
`emailVerificationToken`, and run that request manually — this step is intentionally never automated
outside local dev, since email-ownership verification is a security control, not busywork to script around.

**Deactivating a user** (`06-Platform-Admin/Tenant-Users` and `07-Tenant-Admin/Users`) revokes their access
to that tenant immediately, even mid-session with an already-issued, unexpired JWT — every
`/api/v1/tenant/**`, `/api/v1/me*`, `/api/v1/probes/**`, `/api/v1/security/**` request re-checks membership
status against the DB. Two guards protect against lockout: you can't deactivate yourself
(`CANNOT_DEACTIVATE_SELF`, 409) and can't deactivate a tenant's last active `TENANT_ADMIN`
(`CANNOT_DEACTIVATE_LAST_ADMIN`, 409). The bundled requests target the seeded editor (safe — not an admin,
not you) so they succeed by default; swap in an admin's user id yourself to see the guards fire.

Use **0 - Clear All Tokens (utility)** to wipe every captured token and force a clean re-login (e.g. after a
token's 15-minute TTL expires, or when switching environments).

## Folders

| Folder | Covers |
|---|---|
| 01-Auth-and-Tokens | OAuth2 password/refresh grants (`/oauth2/token`) + `AuthController` self-service (register/verify-email/accept-invite/forgot-reset-password) |
| 02-Me | `MeController`, `MeEpisodeController`, `MeFeedController`, `MeArticleFeedController`, `MeNotificationPreferencesController`, `MeBillingController` (checkout + portal) (subscriber token) |
| 03-Public | `PublicSiteConfigController`, `PublicSubscriptionProductController`, `PublicPodcastController`, `PublicEpisodeDownloadController`, `PublicArticleController` (incl. `/article-categories`) (no auth) |
| 04-RSS-Feeds | `RssFeedController` — public/private feeds + enclosures; PODCAST_RSS-off → 403 `FEATURE_NOT_ENABLED` with per-request restore (pre-flight + cleanup ensures) |
| 14-Article-RSS-Feeds | `ArticleRssFeedController` — public/private article feeds; ARTICLE_RSS-off → 403 `FEATURE_NOT_ENABLED` with per-request restore (pre-flight + cleanup ensures) |
| 15-Custom-Article-Feeds | `MeArticleFeedController` custom (feed-builder) feeds + `ArticleRssFeedController` token URLs — preview, create/update, duplicate title, missing categories, disable/enable/rotate/delete, ARTICLE_FEED_BUILDER-off 404 |
| 05-Security-and-Probes | `SecurityProbeController`, `ModuleProbeController`, and a `Multi-Tenant-Isolation` subfolder covering Host/JWT mismatch, platform-vs-tenant denial, and domain verification |
| 06-Platform-Admin | Tenants, Modules, Admins, Tenant-Users (incl. deactivate/reactivate/resend-invite), Audit, Overview, Tenant-Media, Queue — `PLATFORM_ADMIN` role, no `Host` header |
| 07-Tenant-Admin | Branding, Domains, Users, Products, Subscriptions (incl. subscribers list), Content-Email-Templates, Stripe Connect + billing dashboard — `TENANT_ADMIN` role |
| 12-Webhooks | `StripeWebhookController` — inbound Stripe signature path (missing + invalid `Stripe-Signature`), no JWT |
| 08-Media | `MediaController` upload-url → confirm → preview-url → delete flow |
| 09-Podcast-Content | Formats, Categories, Series, Episodes — full draft → publish/schedule/unpublish/archive workflow |
| 10-Health-and-Docs | Actuator health/info, OpenAPI docs |
| 11-Articles | `ArticleController` — Write desk draft → publish/schedule/unpublish/archive workflow |

## Environments

- **local** — `http://localhost:8080` against the seeded `alpha-show-a` / `alpha-show-b` dev tenants, plus
  `mailpitUrl` (`http://127.0.0.1:8025`) for the auto-verify step above.
- **dev** — placeholder for the first deployed environment. Update `baseUrl` and the tenant hosts once
  Directwerk is deployed (see the Coolify section of
  [`../docs/build-and-deploy.md`](../docs/build-and-deploy.md)), and fill in its own secret vars. Has no
  `mailpitUrl` on purpose (there's no Mailpit against a real deployment) — email verification there is
  always the manual step 13 flow.
