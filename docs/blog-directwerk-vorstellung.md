# Directwerk: Whitelabel-Infrastruktur für Podcast und Membership

*Ein Blick hinter die Kulissen einer API-first Publishing-Plattform, die Creators ihre Marke, ihre Hörer und ihre Daten lassen.*

---

Viele Podcaster und Publisher hängen heute an Patreon, Steady oder einem geschlossenen CMS. Domain, Abonnentenliste und Ausspielung liegen woanders. Directwerk geht den anderen Weg: Du bekommst die Infrastruktur, die Marke bleibt deine.

Directwerk ist eine Multi-Tenant-Whitelabel-Plattform für digitales Publishing. Primär Podcast, dazu Abonnements, private RSS-Feeds und (schrittweise) Artikel. Creators arbeiten im Studio. Hörer kommen über die Website, den Podcatcher oder beides. Agenturen können das Frontend selbst bauen und sprechen dieselbe REST-API an.

## Was das Problem ist

Mitgliedschaft, Podcast-Hosting und Website sind oft drei Tools. Abonnenten-Daten sitzen bei einem US-Anbieter. Der private Feed kommt von einem Dritten. Und sobald du die Domain oder das Branding ändern willst, merkst du, wie eng die Plattform sitzt.

Für Agenturen kommt noch dazu: Ein monolithisches CMS lässt sich schlecht als Whitelabel für zehn Kunden betreiben. Jeder Kunde braucht Isolation, eigene Domain, eigene Module, aber keine zehn Deployments.

## Was Directwerk liefert

Das Produkt ist im Kern das Backend. Darum herum liegen die Apps, die die meisten Creators brauchen:

| Schicht | Name | Aufgabe |
|--------|------|---------|
| Creator-Dashboard | `directwerk-studio` | Episoden, Medien, Produkte, Team |
| Öffentliche Site | `directwerk-web` | Marketing, Pricing, Account, private Feeds |
| Plattform-Betrieb | `directwerk-admin` | Mandanten, Module, Jobs, Storage |
| Vertrag | REST API unter `/api/v1/` | Alles, was Studio und Web können, auch maschinell |

Frontend pro Mandant ist optional. Entweder Referenz-UI von uns, oder ihr bringt euer eigenes mit. Beides hängt am gleichen API-Vertrag. OpenAPI ist Teil des Produkts, kein Nachtrag.

## Der Weg vom Setup zum privaten Feed

1. **Einrichten**  
   Mandant anlegen, Domain verbinden, Branding und Module aktivieren.

2. **Veröffentlichen**  
   Audio und Medien hochladen, Episoden im Studio freigeben.

3. **Monetarisieren**  
   Produkte definieren (LEVEL und PACKAGE), Stripe anbinden, Abonnenten verwalten.

4. **Ausliefern**  
   Öffentliche Feeds für Reichweite, private URLs pro Abonnent, optional Feed-Builder für Formate.

Das ist der Alltagspfad ohne API-Kenntnisse. Darunter liegt die technische Schicht, die den Alltag möglich macht.

## Praxis: Liedermacherleben in fünf Minuten

Theorie ist schön. Besser ist, wenn der nächste Tenant wirklich schnell steht.

Auf Coolify läuft inzwischen ein zweites Domain-Setup: Wildcard `*.directwerk.org`. Damit bekommt jeder Mandant eine Subdomain, ohne pro Show DNS und TLS von Hand zu verdrahten. In `directwerk-admin` habe ich Simons Podcast **Liedermacherleben** als neuen Tenant angelegt: Mandant, Domain, Module. Ungefähr fünf Minuten, dann war die Marke unter der eigenen Subdomain erreichbar.

Was noch fehlt, ist der Inhalt: RSS-Import in `directwerk-studio`. Sobald der Feed drin ist, hängen Episoden, öffentliche Feeds und der Rest am gleichen Stack wie jeder andere Tenant. Der Betriebsschritt (Domain + Isolation) und der Redaktionsschritt (Import) sind bewusst getrennt. Admin richtet die Welt ein, Studio füllt sie.

Genau dafür ist das Multi-Tenant-Modell gebaut: zweiter Creator, gleiche Infrastruktur, kein zweites Deployment.

## Multi-Tenancy: ein Deployment, viele Marken

Jeder Creator (oder jede Agentur-Kundenmarke) ist ein **Tenant**. Traffic wird über den Host aufgelöst: Nur verifizierte Domains binden Anfragen. JWT und Host müssen denselben Tenant ergeben, sonst gibt es `403 TENANT_MISMATCH`.

Technisch heißt das:

- Shared Schema in PostgreSQL, Zeilen mit `tenant_id`
- Hibernate-Filter und Write-Guards gegen Leaks zwischen Mandanten
- Users global, Zugehörigkeit über `tenant_memberships`
- Domain-Verifikation per DNS-TXT (`directwerk-verify=…`)
- In Produktion u. a. Wildcard-Hosts wie `*.directwerk.org` über Coolify, damit neue Tenants ohne Extra-Zertifikat-Tanz live gehen

Für den Creator fühlt sich das wie „meine Seite auf meiner Domain“ an. Für den Betrieb ist es ein Deployment mit klarer Isolation.

## Module statt Feature-Forks

Nicht jeder Tenant braucht alles. Module schalten Fähigkeiten frei, ohne den Code zu forken:

```
DIGITAL_CONTENT  →  PODCAST  →  PODCAST_RSS  →  FEED_BUILDER
                 →  ARTICLES →  ARTICLE_RSS  →  …
                 →  BONUS_CONTENT
```

Dazu kommen Abonnements, Stripe-Billing und (geplant) Patreon/Steady-Sync. Fehlt ein Modul, antwortet die öffentliche Oberfläche mit `403 FEATURE_NOT_ENABLED`. Keine leeren Kataloge, die so tun, als gäbe es den Tenant nicht.

## Inhalte und Zugriffe: FREE vs PAID

Zugang läuft in zwei Schritten:

1. **Content-Gate** am Inhalt: `accessPolicy` ist `FREE` oder `PAID`
2. **Entitlement-Gate** nur bei `PAID`: Union aller aktiven Abos des Users

Zwei Produkttypen:

- **LEVEL** – Stufenleiter über `sortOrder`. Wer Level 3 hat, sieht Inhalte bis Level 3.
- **PACKAGE** – benannte Bundles. Regeln matchen Serie, Format, Kategorie oder „alles Podcast“.

Wichtig: Die Rolle `SUBSCRIBER` bedeutet nur „kann sich anmelden“. Freigeschaltet ist, was die aktiven Subscriptions hergeben. Admins und Editoren können Preview-Wege nutzen; Hörer bekommen nur, was sie bezahlt oder freigeschaltet haben.

## RSS: öffentlich für alle, privat pro Hörer

Öffentliche Feeds (`podcast.xml` und vergleichbare Artikel-Feeds) tragen freie Inhalte. Geeignet für Apple Podcasts, Spotify, Fyyd und Co.

Private Feeds sind tokenisierte URLs pro Abonnent. Der Entitlement-Filter sitzt im Feed selbst: Der Podcatcher sieht nur Episoden, die das Abo freischaltet. Token lassen sich rotieren und widerrufen. Der optionale Feed-Builder lässt Hörer Formate zusammenstellen; der Filter bleibt trotzdem aktiv. Ohne Filter würde der Feed bezahlte Episoden leaken. Das ist hart verdrahtet.

Beispielhafte Form (schematisch):

```text
https://podcast.beispiel.de/feeds/show/u/<persönlicher-token>.xml
```

## Assets: alles in Object Storage

Audio und Dateien liegen in S3-kompatiblem Storage (EU, z. B. Hetzner/Bunny), Keys tenant-präfixiert. Öffentliche und private Sichtbarkeit sind getrennt. Private Bytes laufen über signierte URLs nach Entitlement-Check (`AssetAccessService`). Uploads gehen über Presign in einen Staging-Bereich mit Mime-/Size-Allowlist.

Kurz: Die Datei ist nicht „irgendwo im CMS“, sondern ein adressierbares Asset mit klarer Zugangsregel.

## Stack (kurz und ehrlich)

| Bereich | Technik |
|--------|---------|
| API | Java 21, Spring Boot 4.1, Gradle |
| Daten | PostgreSQL, Flyway |
| Auth | OAuth2 Resource Server / Auth Server, JWT mit `tenant_id` |
| Jobs / Mail | Postgres-Queue, Mailpit lokal |
| Frontends | Next.js, shared UI-Paket `@directwerk/ui` |
| Billing | Stripe Connect (Scaffold), Patreon/Steady als Sync-Pfad |
| Betrieb | Docker, Coolify auf Hetzner |

Lokal startet Infra mit Compose (Postgres + Mailpit), die App mit `bootRun`. Health unter `/actuator/health`, Swagger unter `/swagger-ui.html`.

## API-first als Arbeitsregel

Jede Fähigkeit hat einen REST-Endpunkt. Studio und Web sind Clients derselben API. Keine UI-only-Workflows. Fehler tragen strukturierte `code`-Felder für Integratoren. Bruno-Collection und `.http`-Harness bleiben mit Controllern synchron, damit manuelle Tests nicht wegrutschen.

Für Agenturen heißt das: Ihr könnt ein eigenes Frontend bauen und trotzdem Studio für die Redaktion lassen. Oder nur die API nutzen und alles selbst verdrahten.

## Was schon steht, was noch kommt

**Alpha / vorhanden (Stand Doku 2026-08):** Multi-Tenancy, Module, Studio/Web/Admin-Referenz, Podcast-Domain, öffentliches und privates RSS, Entitlements, Asset-Storage, Stripe-Scaffold.

**Danach u. a.:** härteres Stripe-Billing, Patreon/Steady-Migration mit Dual-Run, Artikel-Desk ausbauen, Plattform-SaaS-Billing für Tenants, E-Mail-Alerts, Outbound-Webhooks, GDPR-Export/Delete.

Directwerk ist also kein fertiges „alles für jeden“-Produkt im Patreon-Sinne, sondern eine Infrastruktur, die den Membership-Podcast-Stack unter eigener Marke trägt und API-seitig erweiterbar bleibt.

## Für wen das Sinn ergibt

- **Creators**, die Domain, Hörer und Daten behalten wollen und trotzdem ein Studio brauchen
- **Agenturen**, die Whitelabel für mehrere Mandanten brauchen, ohne zehn CMS-Instanzen
- **Teams**, die RSS ernst nehmen: öffentlich für Reichweite, privat fürs Abo, beides aus einem Backend

Wenn du eher ein integriertes Blog+Newsletter-Produkt suchst (à la Ghost), ist Directwerk der falsche Vergleichspunkt. Hier liegt der Schwerpunkt auf Podcast-Membership-Infrastruktur und dem API-Vertrag darunter.

## Weiterlesen

- Produktspezifikation: `docs/platform-design.md`
- Entitlements: `docs/content-subscriptions-and-entitlements.md`
- Multi-Tenancy: `Directwerk/docs/multi-tenancy.md`
- Asset-Storage: `docs/asset-storage.md`
- Öffentliche Doku (VitePress): `directwerk-docs/`

---

*Draft für einen deutschen Blog-Post. Ton: Showcase + Erklärung. Bitte vor Veröffentlichung Domain/Links, Launch-Status und konkrete Demo-URLs einsetzen.*
