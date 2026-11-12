# State machines (implicit and explicit)

Directwerk has one shared **content publication** machine and several smaller
stateful lifecycles. This document is the inventory: where each state lives, who
may change it, and what clients/agents are told about it.

**Rule:** if an action is only valid in some states, it belongs in the machine's
transition table — not in a controller `if`, a Studio button, or an agent prompt.

---

## 1. Content publication (episodes and articles)

**States:** `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`

**Source of truth:** `PublicationActions.forContent(...)` in
`Directwerk/directwerk-common/src/main/java/de/pnnit/directwerk/modules/content/`.
The same table drives the workflow guards and the API's `availableActions`.

| From | Action | To | Notes |
|------|--------|----|-------|
| `DRAFT` | `PUBLISH` | `PUBLISHED` | validate + promote media |
| `DRAFT` | `SCHEDULE` | `SCHEDULED` | `scheduledAt` must be in the future |
| `SCHEDULED` | `PUBLISH` | `PUBLISHED` | scheduled worker or "publish now" |
| `SCHEDULED` | `CANCEL_SCHEDULE` | `DRAFT` | clears `scheduledAt` |
| `PUBLISHED` | `UNPUBLISH` | `DRAFT` | applies any working draft first |
| `PUBLISHED` | `ARCHIVE` | `ARCHIVED` | rejected while a working draft exists |
| `PUBLISHED` | `PUBLISH` | `PUBLISHED` | only with a working-draft overlay |
| `PUBLISHED` | `DISCARD_DRAFT` | `PUBLISHED` | drops the overlay only |
| `ARCHIVED` | `UNARCHIVE` | `DRAFT` | clears `publishedAt` / `scheduledAt` |
| any | `DELETE` | — | allowed in every state for episodes/articles |

`EDIT` is state-dependent: allowed in `DRAFT` and `PUBLISHED` (live edits become
a working draft), not in `SCHEDULED` or `ARCHIVED`. `NOTIFY` is a
`PUBLISHED`-only recovery action for subscriber email.

**Enforcement:** `PublicationWorkflow` (`directwerk-core/.../core/content/`) and
the module hooks in `PublicationWorkflowService` (podcast) and
`ArticlePublicationWorkflowService` (newsletter).

**Partial state:** `PUBLISHED` + non-empty `workingDraft` is a distinct
sub-state. It permits `PUBLISH`/`DISCARD_DRAFT` and forbids `ARCHIVE`.

**API:** `availableActions` on `EpisodeView` and `ArticleView` (list and detail).
`availableActions` is **state-valid only**; per-user RBAC is separate.

---

## 2. Bonus files (digital publications)

**States:** `DRAFT`, `PUBLISHED`, `ARCHIVED`

**Source of truth:** `PublicationActions.forDigitalPublication(...)`; the
service enforces the same transitions.

| From | Action | To |
|------|--------|----|
| `DRAFT` | `PUBLISH` | `PUBLISHED` |
| `DRAFT` | `EDIT`, `DELETE` | — |
| `PUBLISHED` | `UNPUBLISH` | `DRAFT` |
| `PUBLISHED` | `ARCHIVE` | `ARCHIVED` |
| `ARCHIVED` | `UNARCHIVE` | `DRAFT` |
| `ARCHIVED` | `EDIT`, `DELETE` | — |

No scheduling and no working-draft overlay. Published files cannot be edited,
archived twice, or deleted; withdraw or archive first. Archived files stay
editable until restored.

**Enforcement:** `DigitalPublicationService`. `archive` now requires
`PUBLISHED` (previously any state was accepted over the API).

**API:** `availableActions` on `DigitalPublicationView`.

---

## 3. Podcast series

**States:** `DRAFT`, `PUBLISHED`

**Source of truth:** `PublicationActions.forSeries(...)` plus
`SeriesService.requireValidStatusTransition`.

| From | Action | To | Guard |
|------|--------|----|-------|
| `DRAFT` | `PUBLISH` | `PUBLISHED` | channel artwork required |
| `PUBLISHED` | `UNPUBLISH` | `DRAFT` | drops the series from feeds |

No delete endpoint. `EDIT` is allowed in both states.

**API:** `availableActions` on `SeriesView`.

---

## 4. Media asset

**States:** `PENDING`, `READY`, `PENDING_DELETE`, `ARCHIVED`

This machine is still enforced across several classes rather than one table:

| Transition | Owner |
|------------|-------|
| `PENDING → READY` | `UploadService.confirmUpload`, `RemoteAssetIngestService` |
| `PENDING → ARCHIVED` | rejected/failed ingest (`UploadService.rejectPendingAsset`, remote ingest) |
| `READY → PENDING_DELETE` | `MediaAssetLifecycleService.delete` |
| `PENDING_DELETE → ARCHIVED` | `MediaS3DeleteJobHandler` / `MediaCdnPurgeJobHandler` |
| `PENDING_DELETE → READY` | delete job re-check found a new content reference |

Invariants: only `READY` assets may be attached or previewed; `ARCHIVED` is
terminal; `PENDING_DELETE` is idempotent. Upload confirmation is a separate
presign → PUT → confirm loop with a 24h staging sweep for abandoned `PENDING`
rows.

**Client guidance:** status is exposed on `MediaAssetView`; `actions` are not yet
modelled. UI deletes are only offered off `PENDING_DELETE`/`ARCHIVED`.

---

## 5. Queue jobs

**States:** `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`

**Enforcement:** `QueueRepository` SQL, not Java:

- claim: `QUEUED` (or expired lease) → `PROCESSING`, increments `attempts`
- complete: `PROCESSING` + owning worker + valid lease → `COMPLETED`
- fail: retryable → `QUEUED`; exhausted → `FAILED`
- expired lease with `attempts >= max_attempts` → `FAILED`

Legal transitions are encoded in the `WHERE` clauses, so a stale worker cannot
complete or fail a re-claimed job. Correlated `QUEUED` jobs coalesce through a
partial unique index.

---

## 6. Subscriptions (billing)

**States:** `INCOMPLETE`, `ACTIVE`, `PAST_DUE`, `CANCELED`

Provider-driven; the local row follows Stripe (or a manual grant). Key rules:

- `CANCELED` is terminal against stale non-terminal rewrites (`PAST_DUE`,
  `INCOMPLETE`); a fresh checkout may legitimately re-activate the row.
- `MARK invoice paid` only moves `PAST_DUE`/`INCOMPLETE → ACTIVE`.
- A `CANCELED` row may be taken over by a new Stripe subscription id; a live id
  may not be rebound.
- Manual grants cannot overwrite an active Stripe relationship.

**Enforcement:** `StripeSubscriptionSyncService`, `SubscriptionService`,
`SubscriptionRevocationWriter`. The Studio label map also carries a dead
`EXPIRED` state that the backend enum does not have.

### Stripe Connect account

**States:** `PENDING`, `RESTRICTED`, `CONNECTED` (derived, stored as a string)

| Capabilities | Derived state |
|--------------|---------------|
| `chargesEnabled = true` | `CONNECTED` |
| details submitted, charges still off | `RESTRICTED` |
| onboarding incomplete | `PENDING` |

`payoutsEnabled` is an independent capability. The state is recomputed from
Stripe account updates (`applyAccountUpdate`) and explicit refreshes; it is
never set by a local transition endpoint.

---

## 7. Newsletter subscriptions

**States:** `PENDING`, `ACTIVE`, `UNSUBSCRIBED`

| From | Action | To |
|------|--------|----|
| `PENDING` | confirm token | `ACTIVE` |
| `ACTIVE` | unsubscribe | `UNSUBSCRIBED` |
| `UNSUBSCRIBED` | request subscribe | `PENDING` |
| any | admin remove | `UNSUBSCRIBED` |

Confirm/unsubscribe tokens are single-use: confirming clears the confirm token;
unsubscribing clears both tokens and applies to every list for that email in the
tenant.

**Enforcement:** `NewsletterSubscriptionService`.

---

## 8. Membership, user and tenant status

| Entity | States | Transition owner and guard |
|--------|--------|----------------------------|
| `TenantMembership` | `INVITED`, `ACTIVE`, `DISABLED` | invitation acceptance; deactivate/reactivate; last-active-admin and self-deactivation guards |
| `User` | `PENDING_VERIFICATION`, `ACTIVE`, `DISABLED` | registration/verification; `DISABLED` is currently not written by any service |
| `Tenant` | `ACTIVE`, `SUSPENDED` | platform suspend/reactivate; suspended tenants fail authentication and API-key auth |
| `TenantDomain` | pending (`verified=false` + token) → verified (`verifiedAt`) | `TenantDomainService` DNS/HTTP challenge or platform bootstrap |
| `EspConnection` | `CONNECTED`, `DISABLED` | credential/test-connection flow |
| `NewsletterList` | `ACTIVE`, `ARCHIVED` | list service; archived lists disappear from public opt-in and article audience checks |

**Enforcement:** `InvitationAcceptanceService`, `EmailVerificationService`,
`TenantMembershipManagementService`, `TenantManagementService`,
`TenantDomainService`, `TenantEspConnectionService`, `NewsletterListService`.

Only a verified domain binds request traffic; the verification token proves
control during the challenge and is not a separate credential.

---

## 9. Private feeds and API keys

- `SubscriberFeed` / article feeds: `enabled` boolean (feed 404s when false) and
  token rotation (the old token stops matching immediately).
- `TenantApiKey`: usable = not revoked and not expired (`revokedAt`,
  `expiresAt`), plus scopes.

These are explicit predicates on the entities, not separate status columns.

---

## 10. Subscriber-notification claim

`emailNotifiedAt` is a one-shot claim: publish sets it only when the update
claims the row, so retries and concurrent publishes cannot double-send. A
published item can clear and re-claim it through the `NOTIFY` action.

**Enforcement:** `PublicationWorkflow` + `claimEmailNotification` in each module
repository.

---

## Contract for clients and agents

Studio projections expose `availableActions` on episodes, articles, bonus files
and series:

```json
{
  "status": "PUBLISHED",
  "hasWorkingDraft": true,
  "availableActions": ["EDIT", "UNPUBLISH", "NOTIFY", "DELETE", "PUBLISH", "DISCARD_DRAFT"]
}
```

- The list is **state-valid only**; the caller may still be denied by RBAC.
- `availableActions` is the authoritative button/affordance list. Do not infer
  actions from `status` in a client.
- Agents should call the action endpoint named by the action and treat a 4xx
  transition error as "state changed since read".

| Action | Episode / article | Bonus file | Series |
|--------|------------------|------------|--------|
| `EDIT` | `PUT /…/{id}` (topic endpoints for tags/media) | `PUT /digital-publications/{id}` | `PUT /series/{id}` |
| `PUBLISH` | `POST /…/{id}/publish` | `POST /digital-publications/{id}/publish` | `PUT /series/{id}` with `status` |
| `SCHEDULE` | `POST /…/{id}/schedule` | — | — |
| `CANCEL_SCHEDULE` | `POST /…/{id}/cancel-schedule` | — | — |
| `UNPUBLISH` | `POST /…/{id}/unpublish` | `POST /digital-publications/{id}/unpublish` | `PUT /series/{id}` with `status` |
| `ARCHIVE` | `POST /…/{id}/archive` | `POST /digital-publications/{id}/archive` | — |
| `UNARCHIVE` | `POST /…/{id}/unarchive` | `POST /digital-publications/{id}/unarchive` | — |
| `DISCARD_DRAFT` | `POST /…/{id}/discard-draft` | — | — |
| `NOTIFY` | `POST /…/{id}/notify` | — | — |
| `DELETE` | `DELETE /…/{id}` | `DELETE /digital-publications/{id}` | — |

## Adding or changing a transition

1. Change the table in `PublicationActions` (or the owning service for the
   machines not yet table-driven).
2. Keep the workflow guard and the API projection reading the same table.
3. Update the module tests for the new legal/illegal case.
4. Update this document and the OpenAPI export.
