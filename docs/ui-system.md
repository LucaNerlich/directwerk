# Directwerk UI system

All Next.js apps in this monorepo use the shared `@directwerk/ui` package.
It is based on shadcn/ui, Base UI, Tailwind CSS v4, and a common neutral,
editorial visual language.

## Principles

- Prefer shared components from `@directwerk/ui/components/*`.
- Keep business and data-fetching logic inside the owning app.
- Use semantic theme tokens (`bg-background`, `text-muted-foreground`,
  `border-border`) instead of hard-coded colors.
- Use `BrandTheme` to apply a tenant primary color. It validates six-digit hex
  colors and computes a readable foreground color.
- Design mobile-first. Navigation collapses below `md`; controls have usable
  touch targets; wide tables get a horizontal scrolling container.
- Provide explicit loading, error, and empty states.

## Setup

Each app imports the shared theme from its `app/globals.css`:

```css
@import '@directwerk/ui/theme.css';
@source '../**/*.{ts,tsx}';
@source '../../packages/ui/src/**/*.{ts,tsx}';
```

`theme.css` chains shared style layers from `packages/ui/src/styles/`:

| File | Purpose |
|------|---------|
| `theme.css` | Tailwind setup, semantic tokens (`:root`), `@theme inline` mapping |
| `app-base.css` | Shared resets (`min-w-0`, heading margins, alert color) |
| `content.css` | `.content-prose` for article/episode HTML bodies |
| `layout.css` | `.page-container`, `.media-player`, `.marketing-container`, `.marketing-section` |
| `forms.css` | `.native-select` for admin filter forms |

App `globals.css` should only add **app-specific** utilities (e.g. studio
`.editor-surface`, admin `.media-asset-row`, homepage `.marketing-container`).

### Semantic tokens

Components and utilities reference tokens, not raw colors:

- Surfaces: `background`, `card`, `muted`, `accent`
- Text: `foreground`, `muted-foreground`, `primary-foreground`
- Chrome: `border`, `input`, `ring`
- Sidebar shell: `sidebar`, `sidebar-accent`, …
- Radius: `--radius` → `rounded-lg`, etc.

Tenant branding overrides `--primary` and `--ring` at runtime via `BrandTheme`
(web layout, studio shell). Fallback primary is defined in `:root`.

### Layout and content utilities

- `PageStack` — vertical page rhythm (`gap-8`)
- `page-container` — centered public-site content width
- `content-prose` — sanitized HTML from articles/episodes/shownotes

Each Next.js config includes:

```ts
transpilePackages: ['@directwerk/ui']
```

Add new shadcn components from `packages/ui`:

```sh
pnpm dlx shadcn@latest add component-name
```

## Component choices

- `SiteShell`: public tenant sites and subscriber demos, with responsive header navigation.
- `AppShell`: authenticated application areas with responsive sidebar navigation.
- `AdminShell`: platform administration wrapper around `AppShell`, with English accessibility labels.
- `PageHeader`: page title, context, and primary action.
- `PageStack`: consistent vertical spacing between page sections.
- `SectionHeader`: section title, optional description and action.
- `StatCard`, `FeatureCard`: KPI tiles and action/desk cards.
- `ListPanel`, `ListPanelRow`: bordered list rows with hover states.
- `EmptyState`: empty collections and first-run guidance.
- `AuthCard`: login, registration, invitation, and password flows.
- `ResponsiveTable`: horizontally scrollable table wrapper.

Use direct imports to preserve bundle splitting:

```tsx
import {Button} from '@directwerk/ui/components/button'
```

Do not create a package barrel file.

## Migration checklist

1. Replace unscoped global element styles.
2. Replace native controls with shared components where behavior is unchanged.
3. Preserve accessible names and existing test semantics.
4. Verify keyboard focus, narrow-screen layout, loading, errors, and empty data.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm build` from the repo root (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

New pages: [`frontend-pages.md`](frontend-pages.md).
