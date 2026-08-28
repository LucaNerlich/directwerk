# Adding a page in Directwerk frontends

Shared conventions for `directwerk-studio`, `directwerk-web`, and
`directwerk-admin`. See also [`docs/ui-system.md`](../docs/ui-system.md).

## 1. Create the route

Use the Next.js App Router under `app/`:

| App | Example route file |
|-----|-------------------|
| Studio | `app/(studio)/write/articles/page.tsx` |
| Web | `app/pricing/page.tsx` |
| Admin | `app/tenants/[id]/page.tsx` |

Prefer **server components** for read-only pages; add `'use client'` only when
you need hooks, browser APIs, or client-side auth state.

## 2. Layout shell

| App | Wrapper |
|-----|---------|
| Studio / Admin | Routed inside `AppShell` / `AdminShell` (layout.tsx) |
| Web | Routed inside `SiteHeader` → `SiteShell` (root layout) |

Use shared layout primitives:

```tsx
import PageStack from '@directwerk/ui/components/page-stack'
import PageHeader from '@directwerk/ui/components/page-header'

export default function MyPage() {
  return (
    <PageStack className="page-container"> {/* web only */}
      <PageHeader title="…" description="…" />
      {/* content */}
    </PageStack>
  )
}
```

Studio/admin pages typically use `<PageStack>` without `page-container`.

## 3. Data fetching

- **Studio / Admin:** tenant or platform API via `lib/api/` clients; respect
  module gates (`PODCAST`, `SUBSCRIPTION`, …).
- **Web:** public endpoints via `lib/api/client.ts`; subscriber endpoints need
  JWT from `tokenStore`.
- **Server:** use `getTenantHost()` + `fetch*Server` helpers where they exist.

## 4. States

Every list or detail page needs:

1. **Loading** — short muted text or skeleton
2. **Error** — `<Alert variant="destructive">` with `AlertDescription`
3. **Empty** — `<EmptyState>` with a clear next action

## 5. Styling rules

- Import components from `@directwerk/ui/components/*` (no package barrel).
- Use semantic tokens: `bg-card`, `text-muted-foreground`, `border-border`.
- Use `ListPanel`, `SectionHeader`, `StatCard` for repeated patterns.
- Put prose HTML in `className="content-prose"`.
- App-specific CSS belongs only in that app's `globals.css` (e.g. studio
  `.editor-surface`).

## 6. Tests

Add a colocated `*.test.tsx` when the page has non-trivial client logic.
Mock API modules with `vi.mock('@/lib/api/…')`.

```bash
pnpm test          # from the app directory
pnpm typecheck
pnpm build
```

Root workspace: `pnpm test && pnpm typecheck && pnpm build` from repo root.

## 7. Auth redirects (web)

After login/register, honor `?returnTo=` via `safeReturnTo()` from
`lib/auth/safeReturnTo.ts` — never redirect to external URLs.
