# Directwerk — Product Naming Strategy

Companion to [`README.md`](platform-design.md). **Directwerk** is the chosen public product name —
an international spelling of the Direktwerk idea (*direct* + *Werk*): craft/infrastructure for
publishing straight to your audience. **Publish** was the internal codename used before the
rename below; it no longer appears in repo folders, packages, or identifiers.

| Document | Purpose |
|----------|---------|
| [`README.md`](platform-design.md) | Full platform design |
| [`content-platform-strategy.md`](content-platform-strategy.md) | Product scope — publication platform, not CMS |
| [`directwerk-studio.md`](directwerk-studio.md) | Creator dashboard — primary non-technical UX |
| [`ghost-positioning.md`](ghost-positioning.md) | Competitive positioning |
| **This document** | Public product name — criteria, decision, rename map |

**Status (2026-08):** Public name **chosen: Directwerk**. Full technical rename executed
2026-08-14 — repo folders, npm packages, Java package (`de.pnnit.directwerk`), and OAuth/email
identifiers all use `directwerk`. Domain + trademark clearance still required before public
launch.

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

| Layer | Value |
|-------|-------|
| **Marketing / legal** | Directwerk |
| **Repo folders** | `directwerk/` monorepo (`Directwerk/`, `directwerk-studio/`, …) |
| **Java package** | `de.pnnit.directwerk` |
| **Reference apps** | `directwerk-web`, `directwerk-studio`, `directwerk-admin` |
| **API Host** | `api.directwerk.de` (or chosen TLD) — still TODO, see [Validation checklist](#validation-checklist-before-public-launch) |
| **OpenAPI `title`** | Directwerk API |
| **Docs** | “Directwerk platform” |

Full technical rename (see [Rename impact](#rename-impact-checklist)) is done — no remaining
`publish` identifiers in code, configs, or docs.

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

Recorded in [`README.md` § Open Decisions](platform-design.md#open-decisions).

---

## Rename impact checklist (full technical rename)

Executed 2026-08-14:

| Area | Files / systems | Status |
|------|-----------------|--------|
| Monorepo | `publish-admin`/`publish-studio`/`publish-web` → `directwerk-admin`/`directwerk-studio`/`directwerk-web` | Done |
| npm packages | `@publish/ui` → `@directwerk/ui`; root workspace `directwerk-apps` | Done |
| Gradle / Java | `settings.gradle`, `de.pnnit.directwerk` package | Already on `directwerk` before this pass |
| OAuth / email identifiers | `publish-platform-admin`, `publish-tenant-frontend`, `publish-api` audience/scope, `publish.local` example domain → `directwerk-*` / `directwerk.local` | Done |
| HTTP tests / Bruno | `http-client.env.json`, `bruno/environments/*` | Done |
| Cross-project refs | `AGENTS.md`, `README.md`, all `docs/*.md` | Done |
| Database | No change required (tenant-scoped, not product-named) | N/A |

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
| **Next step** | Domain + DPMA/EUIPO + lawyer review before public marketing |

---

## Related reading

- Product scope: [`content-platform-strategy.md`](content-platform-strategy.md)
- Positioning: [`ghost-positioning.md`](ghost-positioning.md)
- Parent brand: [pnn-it.de](https://pnn-it.de/) — product name may stay independent of pnn-it

---

*Last updated: 2026-08-14*
