# Directwerk UI system

All Next.js apps in `projects/publish` use the shared `@publish/ui` package.
It is based on shadcn/ui, Base UI, Tailwind CSS v4, and a common neutral,
editorial visual language.

## Principles

- Prefer shared components from `@publish/ui/components/*`.
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
@import '@publish/ui/theme.css';
@source '../**/*.{ts,tsx}';
```

Each Next.js config includes:

```ts
transpilePackages: ['@publish/ui']
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
- `EmptyState`: empty collections and first-run guidance.
- `AuthCard`: login, registration, invitation, and password flows.

Use direct imports to preserve bundle splitting:

```tsx
import {Button} from '@publish/ui/components/button'
```

Do not create a package barrel file.

## Migration checklist

1. Replace unscoped global element styles.
2. Replace native controls with shared components where behavior is unchanged.
3. Preserve accessible names and existing test semantics.
4. Verify keyboard focus, narrow-screen layout, loading, errors, and empty data.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm build` from `projects/publish`.
