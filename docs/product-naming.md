# Directwerk — Product Naming Strategy

Companion to [`README.md`](../README.md). **Publish** remains the internal codename for
folders and packages. **Directwerk** is the chosen public product name — an international
spelling of the Direktwerk idea (*direct* + *Werk*): craft/infrastructure for publishing
straight to your audience.

| Document | Purpose |
|----------|---------|
| [`README.md`](../README.md) | Full platform design |
| [`content-platform-strategy.md`](content-platform-strategy.md) | Product scope — publication platform, not CMS |
| [`publish-studio.md`](publish-studio.md) | Creator dashboard — primary non-technical UX |
| [`ghost-positioning.md`](ghost-positioning.md) | Competitive positioning |
| **This document** | Public product name — criteria, decision, rename map |

**Status (2026-07):** Public name **chosen: Directwerk**. Repo folders and Java package remain
`publish` until a display-only or full rename sprint. Domain + trademark clearance still required
before public launch.

---

## Why “Publish” fails

| Problem | Example |
|---------|---------|
| **Ungoogleable** | `"publish podcast membership"` returns millions of generic hits |
| **No trademark room** | Common English verb; hard to protect in software classes |
| **Ambiguous in DE** | Same word in German/English; no local distinctiveness |
| **Collides with everything** | npm packages, CMS plugins, CI jobs, book publishers |
| **Weak whitelabel story** | Tenants cannot build a memorable brand *on* a name that means nothing specific |

Good comparables in the space use **coined or compound** names: Substack, Steady, Transistor,
Memberful, Supercast — not dictionary verbs.

---

## What the name must communicate

Primary positioning (from [`content-platform-strategy.md`](content-platform-strategy.md) and
[`ghost-positioning.md`](ghost-positioning.md)):

| Priority | Message |
|----------|---------|
| **1** | **Own your stack** — domain, subscribers, entitlements (whitelabel infrastructure) |
| **2** | **Publish and monetize in multiple formats** — audio, articles, newsletters, and downloads |
| **3** | **EU / German creator market** — Steady exit, GDPR-friendly hosting |
| **4** | **API-first** — agencies and custom frontends (optional in name, not required) |

The name does **not** need to say “CMS”, “newsletter”, or “blog”. Post-MVP articles are a channel on
the same platform. Lead with **ownership + membership + independent publishing**, not a single
content format.

---

## Naming criteria (score each candidate 1–5)

| Criterion | Target |
|-----------|--------|
| **Distinctiveness** | Unique Google query — `"<name> creator membership"` or `"<name> publishing"` returns us in top 5 |
| **Memorability** | 2–3 syllables; easy to spell after hearing once |
| **German market fit** | Pronounceable in DE; `.de` domain plausible; no awkward meaning |
| **International** | Does not confuse EN speakers; no unintended slang |
| **Trademark** | Preliminary clearance in EU (Class 42 SaaS) — lawyer review before launch |
| **Domain** | `.de` + `.com` or `.io` available (or affordable) |
| **Technical** | Valid DNS label, npm/Java package slug, no reserved words |
| **Whitelabel** | Works in tenant copy: *“Powered by \<Name\>”* without competing with tenant brand |

The name should feel **alive and understandable on first hearing**. Prefer a short word or compound
whose basic idea is clear without a second metaphor. German or DE/EN hybrid names are welcome when
they stay short and do not need a gloss for the German target market.

**Anti-patterns:** single common verbs (`Publish`, `Share`, `Create`), generic `-ly` SaaS names,
names already used by creator platforms, names tied to one format only (`Eigenklang`, `RSSify`),
long German compounds (`Mitgliedswerk`), and opaque metaphors (`fold`).

---

## Chosen name: Directwerk

| Field | Value |
|-------|-------|
| **Display** | Directwerk |
| **Slug** | `directwerk` |
| **Story** | *Direct* (EN) + *Werk* (DE craft / workshop / works) — infrastructure to publish and sell **directly** to your audience |
| **Why this spelling** | More international than **Direktwerk**; keeps German *Werk* for DE market fit |
| **Tagline (DE)** | „Publizieren und verkaufen — direkt auf deiner Domain.“ |
| **Tagline (EN)** | „Direct publishing and membership infrastructure — on your domain.“ |
| **Whitelabel** | “Powered by Directwerk” |

**Runner-up kept as backup:** **Eigenplatz** (ownership + place). Prefer Eigenplatz only if
Directwerk fails domain/trademark clearance.

### Clearance notes (research, not legal opinion)

| Check | Preliminary finding (2026-07) |
|-------|-------------------------------|
| Creator SaaS collision | No obvious creator membership platform named Directwerk |
| Nearby brands | NL **DirectWerk** / Directwerk Zorg (care staffing); DE **Direktwerke** GmbH electronics record |
| Similar rejected forms | Directworks (manufacturing sourcing SaaS); Directforge (liked but too long) |
| Still required | `directwerk.de` / `.com` / `.io`; EUIPO Classes 9/42; DPMA; lawyer sign-off |

---

## Naming history (how we got here)

Directions explored: ownership, membership, publishing craft, direct relationship, place/home, motion.

| Outcome | Names |
|---------|-------|
| **Chosen** | **Directwerk** |
| **Runner-up** | Eigenplatz |
| **Considered, not chosen** | Direktwerk (DE spelling), Directforge / Dirforge, Eigenabo, Eigenkanal, Aboheim, Sendhaus, TakeRoot, Klarpost, … |
| **Rejected** | Publish, Eigenklang, Ownfold, Podwerk, audio-first German compounds, fold-metaphors, … |

Full parked / rejected tables kept below for reference.

### Parked alternatives

| Name | Notes |
|------|-------|
| **Eigenplatz** | Strong ownership/home story — backup if Directwerk fails clearance |
| **Direktwerk** | Same idea as Directwerk; fully German spelling — superseded by international form |
| **Directforge / Dirforge** | Liked energy; Directforge too long; Dirforge more coined |
| **Eigenabo / Eigenkanal / Aboheim / Sendhaus** | Clear DE reads; not preferred over Directwerk |
| **TakeRoot / Klarpost / GoDirect / Makeway / …** | Motion or hybrid options with higher collision or clarity risk |

### Rejected or defer

| Name | Reason |
|------|--------|
| **Publish** | Generic (codename only) |
| **Eigenklang** | Ownership idea good; *Klang* locks to audio |
| **Eigenraum** | Taken — German math podcast |
| **Podwerk** | *Pod* narrows to podcasts |
| **Tonpost / Klangbasis / Tonabo / Horchwerk** | Audio-first |
| **Freischalt / Mitgliedswerk** | Feature-specific or too long |
| **Ownfold / Pressfold / Memberfold** | Opaque or competitor-adjacent “fold” |
| **Ownward** | Too close to Onward |
| **Foliora** | Coined, long, not self-explanatory |
| **Sendwerk / Feedwerk / Castwerk / Briefton** | Taken |
| **Hörwerk / Hoerwerk / Abocast / Klangpass** | Category collisions |
| **Substack.de-style clones** | Derivative; trademark risk |

---

## Product name vs technical identifiers

Do **not** block implementation on rename. Standard pattern:

| Layer | Until rename | After rename (Directwerk) |
|-------|--------------|---------------------------|
| **Marketing / legal** | Publish | Directwerk / product site |
| **Repo folders** | `projects/publish/` | Optional: `projects/directwerk/` (large diff) or keep path |
| **Java package** | `de.pnnit.publish` | `de.pnnit.directwerk` (or keep package, change display name only) |
| **Reference apps** | `publish-web`, `publish-studio`, `publish-admin` | `directwerk-web` or tenant-neutral `studio`/`admin` |
| **API Host** | `api.publish.example` | `api.directwerk.de` (or chosen TLD) |
| **OpenAPI `title`** | Publish API | Directwerk API |
| **Docs** | “Publish platform” | “Directwerk platform” with note “formerly Publish” |

**Minimal rename (recommended first):** change **display name**, domains, and docs only — keep
`projects/publish/` and `de.pnnit.publish` until post-MVP to avoid churn during alpha.

**Full rename:** schedule dedicated sprint — see [Rename impact](#rename-impact-checklist).

---

## Validation checklist (before public launch)

| # | Check | How | Status |
|---|-------|-----|--------|
| 1 | Google uniqueness | `"Directwerk" publishing`, membership, creator, SaaS | Preliminary — OK; confirm at launch |
| 2 | Domain | `.de`, `.com`, `.io` | **TODO** |
| 3 | EU trademark | [EUIPO eSearch](https://euipo.europa.eu/eSearch/) — Classes 9, 42, 45 | **TODO** |
| 4 | German trademark | DPMA | **TODO** |
| 5 | App stores | Apple/Google | **TODO** |
| 6 | GitHub/npm/Maven | Package namespace | **TODO** |
| 7 | Social handles | `@directwerk` | **TODO** |
| 8 | Pronunciation test | DE/EN speakers spell after hearing | **TODO** |
| 9 | “Powered by” test | Tenant footer | Passes internally |
| 10 | Lawyer sign-off | Written clearance | **TODO before public launch** |

Recorded in [`README.md` § Open Decisions](../README.md#open-decisions).

---

## Rename impact checklist (full technical rename)

When codename changes beyond display strings:

| Area | Files / systems |
|------|-----------------|
| Monorepo | `projects/publish/` → rename; CI paths in `.github/workflows/projects-ci.yml` |
| Gradle | `settings.gradle.kts`, `rootProject.name`, artifact coordinates |
| Java | `de.pnnit.publish` package refactor (IDE) |
| Docker / Coolify | Image names, env vars, service labels |
| HTTP tests | `http-client.env.json`, folder paths |
| Deployment | `deployment/` scripts referencing publish |
| Cross-project refs | `AGENTS.md`, root docs, `publish-web` if exists |
| Database | No change required (tenant-scoped, not product-named) |

Estimate: **display-only rename** ≈ 1 doc PR; **full package rename** ≈ large mechanical refactor —
defer until alpha backend compiles.

---

## Messaging with Directwerk

| Old | New |
|-----|-----|
| “Publish is an API-first…” | “**Directwerk** is an API-first…” |
| “Publish vs Ghost” | “**Directwerk** vs Ghost” ([`ghost-positioning.md`](ghost-positioning.md)) |
| “German Substack alternative” | “**Directwerk** — Publikations- und Mitgliedschafts-Infrastruktur auf deiner eigenen Domain” |
| “Powered by Publish” | “Powered by **Directwerk**” |

Avoid claiming “Substack killer” in trademark-sensitive regions — use **alternative** or
**infrastructure**.

---

## Open decision

| Field | Value |
|-------|-------|
| **Decision** | Public product name |
| **Options** | Directwerk (chosen) · Eigenplatz (backup) |
| **Recommended** | **Directwerk** |
| **Chosen** | **Directwerk** |
| **Next step** | Domain + DPMA/EUIPO + lawyer review before public marketing; display-name rollout in docs when ready |

---

## Related reading

- Product scope: [`content-platform-strategy.md`](content-platform-strategy.md)
- Positioning: [`ghost-positioning.md`](ghost-positioning.md)
- Parent brand: [pnn-it.de](https://pnn-it.de/) — product name may stay independent of pnn-it

---

*Last updated: 2026-07-17*
