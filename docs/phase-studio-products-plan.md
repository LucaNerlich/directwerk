# Studio Product Management — Implementation Plan (Issue #12)

Status: **Partially shipped.** The core product CRUD UI exists (`/manage/products`).
This plan covers the remaining gaps to make the level-gated subscription flow
complete end-to-end from Studio.

---

## What already works

| Feature | Location |
|---------|----------|
| Product list (LEVEL + PACKAGE) | `/manage/products` → `ProductListClient` |
| Create product (title, slug, offering type, sort order, price, interval) | `/manage/products/new` → `ProductEditor` |
| Edit product (title, sort order, price, active toggle) | `/manage/products/[productId]` |
| PACKAGE access rules editor | `ProductRulesEditor` (shown when `offeringType === 'PACKAGE'`) |
| Manual grant/revoke subscriptions | `/manage/grants` |
| Subscribers list | `/manage/subscribers` |
| Stripe sync (push product to Stripe) | "Mit Stripe synchronisieren" button on product detail |
| Deactivate product | "Deaktivieren" button on product detail |
| Module gate (`SUBSCRIPTION` required) | `SubscriptionModuleGate` wrapper |

---

## Gaps to close

### ~~1. Episode `requiredLevelSortOrder` picker~~ — DONE

Already shipped as `LevelSelect` component (`components/studio/LevelSelect.tsx`).
Used in the episode editor ("Mindest-Stufe" dropdown, disabled when FREE),
article editor, and format editor. Populates from `listPublicLevels`.

### 1. Visual level ladder on product list

The current list shows products flat. For LEVEL products, the sort order
defines the tier hierarchy but isn't visually emphasized.

**Plan:**
- Group or badge LEVEL products with their `sortOrder` value (e.g. "Stufe 10").
- Optional: show subscriber count per product (requires new API or extend
  existing `GET /tenant/products` response with `subscriberCount`).
- Sort LEVEL products by `sortOrder` ascending in the UI.

### ~~3. Format `requiredLevelSortOrder` editor~~ — DONE

Already shipped in `FormatEditor.tsx` using `LevelSelect`.

### 4. Stripe Checkout flow (future — separate issue)

Products have pricing metadata but live checkout is not wired. This is
tracked separately and depends on Stripe Connect onboarding in `/settings/stripe`.

---

## Core mental model for creators

```
Product (LEVEL, sortOrder: 10, "Fan")        ← cheapest tier
Product (LEVEL, sortOrder: 20, "Supporter")  ← mid tier
Product (LEVEL, sortOrder: 30, "Patron")     ← top tier

Episode (PAID, requiredLevelSortOrder: 20)
  → Supporter and Patron can listen; Fan cannot
```

A subscriber's effective level = max `sortOrder` among their active LEVEL subscriptions.
PACKAGE products bypass the level ladder entirely (bundle access).

---

## Suggested implementation order

1. **Level ladder visual** — sort + badge on product list (frontend-only)
2. **Stripe Checkout** — separate workstream, depends on Connect onboarding

The core level-gating flow (create products → set episode minimum level →
grant subscriptions) is **already complete end-to-end** in Studio.
