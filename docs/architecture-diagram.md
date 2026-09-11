# Directwerk — Architektur im Überblick (Akteure × Oberflächen × Plattform)

Für Blog-Post / Vorstellung. Quelle: [`README.md`](../README.md), [`docs/platform-design.md`](platform-design.md), [`docs/blog-directwerk-vorstellung.md`](blog-directwerk-vorstellung.md).

```mermaid
flowchart TB
    subgraph AKTEURE["Akteure"]
        direction TB
        CREATOR["🎙️ Creator / Redaktion"]
        VISITOR["👂 Hörer / Besucher"]
        SUB["⭐ Abonnent"]
        ADMIN["🛠️ Platform-Admin"]
        AGENCY["🔌 Agentur / Integrator"]
        PODCATCHER["📱 Podcatcher<br/>(Apple, Spotify, Fyyd)"]
        PRESS["🔎 Interessenten & Entwickler"]
        CREATOR ~~~ VISITOR ~~~ SUB ~~~ ADMIN ~~~ AGENCY ~~~ PODCATCHER ~~~ PRESS
    end

    subgraph OBERFLAECHEN["Fünf Oberflächen (Next.js / VitePress)"]
        direction TB
        STUDIO["directwerk-studio<br/>Creator-Backoffice"]
        WEB["directwerk-web<br/>Public Site + Abo-Portal"]
        ADMINUI["directwerk-admin<br/>Plattform-Konsole"]
        HOME["homepage<br/>Marketing"]
        DOCS["directwerk-docs<br/>Doku + API-Referenz"]
        STUDIO ~~~ WEB ~~~ ADMINUI ~~~ HOME ~~~ DOCS
    end

    subgraph PLATTFORM["Directwerk-API — eine Instanz, alle Tenants"]
        direction TB
        API["REST /api/v1<br/>Host → Tenant, JWT-Crosscheck"]
        MOD["Feature-Module<br/>Podcast · Digital · Newsletter · Subscription · Stripe · Queue · Mail"]
        JOBS["Job-Queue (Postgres)"]
    end

    subgraph INFRA["Infrastruktur (Hetzner, EU)"]
        direction TB
        PG[("PostgreSQL<br/>shared Schema, Zeile pro tenant_id")]
        S3[("S3<br/>public/ · private/, Keys tenant-präfixiert")]
        CDN["CDN (Bunny)"]
        STRIPE["Stripe (Patreon/Steady: geplant)"]
    end

    CREATOR -->|"Serien, Episoden, Artikel,<br/>Produkte, Team"| STUDIO
    VISITOR -->|"Show, freie Episoden,<br/>Preise, Newsletter"| WEB
    SUB -->|"Login, Checkout, Abo-Status,<br/>private Feeds, Downloads"| WEB
    ADMIN -->|"Tenants, Module, Domains,<br/>Jobs, Audit"| ADMINUI
    AGENCY -.->|"BYO-Frontend direkt<br/>an /api/v1"| API
    PODCATCHER -->|"öffentliche RSS +<br/>Enclosures"| API
    PRESS -->|"Landing, /developers"| HOME
    PRESS -->|"Install, Betrieb, API"| DOCS

    STUDIO -->|"OAuth2 · /api/v1"| API
    WEB -->|"BFF-Proxy · /api/v1"| API
    ADMINUI -->|"/api/v1 (platform)"| API
    HOME -.->|"Kontakt-Formular"| API
    DOCS -.->|"OpenAPI-Export<br/>(aus laufender App)"| API

    API <--> PG
    API <--> S3
    API <--> STRIPE
    API --- MOD
    MOD --- JOBS
    JOBS -.->|"CDN-Purge"| CDN
    JOBS -.->|"E-Mail: Einladungen,<br/>Password-Reset, Notifications"| SUB
    S3 --> CDN
```

## Was jeder Akteur tut

| Akteur | Oberfläche | Rolle in der API | Typischer Job |
|--------|-----------|------------------|---------------|
| **Creator / Redaktion** | `directwerk-studio` | `TENANT_ADMIN`, `EDITOR` | Serien & Formate anlegen, Audio/Cover hochladen, Episoden/Artikel schreiben und (gesteuert) publizieren, LEVEL-/PACKAGE-Produkte pflegen, Team einladen |
| **Hörer / Besucher** | `directwerk-web` (öffentliche Flächen) | `GUEST` (ohne Login) | Show ansehen, freie Episoden hören, Preise prüfen, Newsletter abonnieren |
| **Abonnent** | `directwerk-web` (Portal) | `SUBSCRIBER` | Registrieren, Checkout, Abo-Status, persönliche Feed-URLs, Bonus-Downloads |
| **Podcatcher** | RSS direkt an der API | — (kein User) | Öffentliche Feeds ziehen; Enclosure-Redirects nach Analytics-Tracking |
| **Platform-Admin** | `directwerk-admin` | `PLATFORM_ADMIN` | Tenants anlegen/suspenden, Module schalten, Domains verifizieren, Queue-Jobs & Audit beobachten |
| **Agentur / Integrator** | eigenes Frontend → API | je nach Anbindung | BYO-UI gegen denselben `/api/v1`-Vertrag, OpenAPI als Basis |
| **Interessenten / Entwickler** | `homepage`, `directwerk-docs` | — | Produkt verstehen, aufsetzen, integrieren |

## Ein Request, high-level

1. **Tenant-Auflösung** — Die Request-`Host` muss eine verifizierte Tenant-Domain sein (DNS-TXT); JWT und Host müssen denselben Tenant ergeben, sonst `403 TENANT_MISMATCH`.
2. **Module-Gate** — Fehlt dem Tenant das passende Modul (z. B. `PODCAST`), antwortet die API mit `403 FEATURE_NOT_ENABLED`.
3. **Entitlement-Filter** — `FREE`-Content geht offen raus; `PAID`-Content nur gegen aktive Subscriptions (LEVEL/PACKAGE). Free Audio wandert auf den public CDN-Prefix, Paid bleibt auf signierten URLs.
4. **RSS-Spalten** — Öffentliche Feeds (Reichweite: Apple, Spotify, Fyyd) und tokenisierte Private Feeds pro Abonnent kommen aus derselben Snapshot-Logik — der Entitlement-Filter ist dabei nie abschaltbar.

**Kernaussage für den Post:** Sieben Akteure, fünf Oberflächen, eine API. Jede Oberfläche ist ein Client desselben Vertrags; Akteure ohne eigene Oberfläche (Podcatcher, BYO-Frontend) hängen direkt am Vertrag an.
