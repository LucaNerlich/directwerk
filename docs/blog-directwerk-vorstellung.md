# Directwerk: Whitelabel-Infrastruktur für Podcast und Membership

*Ein Blick hinter die Kulissen einer API-first Publishing-Plattform, die Creators ihre Marke, ihre Hörer und ihre Daten lassen.*

---

Viele Podcaster und Publisher hängen heute an Patreon, Steady oder einem geschlossenen CMS. Domain, Abonnentenliste und Ausspielung liegen woanders. Directwerk geht den anderen Weg: Du bekommst die Infrastruktur, die Marke bleibt deine.

Directwerk ist eine Multi-Tenant-Whitelabel-Plattform für digitales Publishing. Primär Podcast, dazu Abonnements, private RSS-Feeds und (schrittweise) Artikel. Das Backend mit REST-API unter `/api/v1/` ist der Vertrag. Darum herum liegen fünf sichtbare Oberflächen, die unterschiedliche Jobs erledigen.

## Was das Problem ist

Mitgliedschaft, Podcast-Hosting und Website sind oft drei Tools. Abonnenten-Daten sitzen bei einem US-Anbieter. Der private Feed kommt von einem Dritten. Und sobald du die Domain oder das Branding ändern willst, merkst du, wie eng die Plattform sitzt.

Für Agenturen kommt noch dazu: Ein monolithisches CMS lässt sich schlecht als Whitelabel für zehn Kunden betreiben. Jeder Kunde braucht Isolation, eigene Domain, eigene Module, aber keine zehn Deployments.

## Die Apps im Überblick

| App | Rolle | Wer nutzt sie |
|-----|------|----------------|
| `homepage` | Marketing der Plattform | Interessenten, Presse, Integratoren auf dem Weg zur Doku |
| `directwerk-admin` | Plattform-Betrieb | Platform-Admins |
| `directwerk-studio` | Creator-Dashboard | Tenant-Admins, Editoren |
| `directwerk-web` | Öffentliche Site + Abonnenten-Portal | Hörer, Gäste, zahlende Mitglieder |
| `directwerk-docs` | Öffentliche Dokumentation | Operatoren, Agenturen, API-Clients |

Frontend pro Mandant ist optional. Entweder Referenz-UI von uns, oder ihr bringt euer eigenes mit. Beides hängt am gleichen API-Vertrag.

## homepage

Die `homepage` ist die Marketing-Site der Plattform (z. B. `directwerk.org`). Sie erklärt das Produkt, den Creator-Pfad und den Stack. Sie ist **nicht** die Website eines einzelnen Podcasts.

Typische Flächen:

- Landing mit Problem, Produktstack und Creator-Journey
- `/developers` mit einem API-Ausschnitt und Link zur vollen Doku
- Kontaktformular gegen die Directwerk-API

Wer hier landet, soll verstehen: Directwerk ist Infrastruktur unter eigener Marke, nicht noch eine geschlossene Creator-Plattform. Danach geht es entweder in die Doku, zum Kontakt oder (für uns intern) in Admin und Studio.

## directwerk-admin

`directwerk-admin` ist die Betriebs-Konsole für die Plattform. Hier entstehen Mandanten, hier werden Module geschaltet, Domains und Storage betrachtet. Creators und Hörer kommen hier nicht hin.

Kernaufgaben:

- Tenant anlegen, suspendieren, Module zuweisen
- Domains und Verifikation im Blick behalten
- Platform-weite Jobs und Ops-Flächen

### Praxis: Liedermacherleben in fünf Minuten

Auf Coolify läuft ein Wildcard-Setup `*.directwerk.org`. Damit bekommt jeder Mandant eine Subdomain, ohne pro Show DNS und TLS von Hand zu verdrahten. In Admin habe ich Simons Podcast **Liedermacherleben** als neuen Tenant angelegt: Mandant, Domain, Module. Ungefähr fünf Minuten, dann war die Marke unter der eigenen Subdomain erreichbar.

Admin richtet die Welt ein. Den Inhalt liefert danach Studio.

## directwerk-studio

`directwerk-studio` ist das Publisher-Backoffice. Hier arbeiten nicht-technische Creators und Redaktionen: Medien hochladen, Episoden und Artikel pflegen, Produkte und Abonnenten verwalten, Branding und Domains für den Tenant.

Creators müssen die REST-API nicht kennen. Studio spricht denselben `/api/v1/`-Vertrag wie jede Agentur-Integration.

Typischer Alltag:

1. Serie und Formate anlegen
2. Audio und Cover in die Media Library
3. Episoden schreiben, `FREE`/`PAID` setzen, veröffentlichen
4. LEVEL- und PACKAGE-Produkte pflegen, Stripe anbinden
5. Team und Rollen im Tenant

Beim Liedermacherleben-Onboarding fehlt genau der nächste Schritt: **RSS-Import in Studio**. Sobald der bestehende Feed drin ist, hängen Episoden, öffentliche Feeds und der Rest am gleichen Stack wie jeder andere Tenant. Betrieb (Admin) und Redaktion (Studio) bleiben bewusst getrennt.

## directwerk-web

`directwerk-web` ist die Referenz-Website **pro Mandant**: Marketing der Show, Pricing, Registrierung, Account und private Feeds. Auf der Tenant-Domain (oder der `*.directwerk.org`-Subdomain) landet der Hörer hier, nicht auf der Plattform-Homepage.

Was die App abdeckt:

- Öffentliche Flächen: Show, freie Episoden, Preise
- Abonnenten-Portal: Login, Abo-Status, persönliche Feed-URLs
- Checkout-Pfade gegen Stripe (soweit angebunden)

Agenturen können `directwerk-web` ersetzen und trotzdem Studio und Admin behalten. Die API bleibt der Vertrag. Für die meisten Creators ist die Referenz-App aber der schnellste Weg zu einer fertigen Hörer-Oberfläche.

## directwerk-docs

`directwerk-docs` ist die öffentliche Doku-Site (VitePress). Install, Betrieb, Architektur und die interaktive API-Referenz leben hier. Die internen Markdown-Dateien unter `docs/` und `Directwerk/docs/` bleiben die Quellen fürs Team; die VitePress-Site kuratiert, was nach außen geht.

Interessant für Integratoren:

- OpenAPI kommt aus dem laufenden Spring-Boot (Export per Gradle), nicht aus handgeschriebenem Spec-Drift
- Operator-Themen wie Multi-Tenancy, Assets, RSS und Entitlements haben eigene Seiten
- Dieselbe Wahrheit wie Bruno/`.http`-Harness und Controller: API-first auch in der Doku

Wer ein BYO-Frontend baut, startet hier. Wer nur Studio nutzt, braucht die Doku selten, aber sie existiert als Produktlieferung, nicht als Nebenbei-Wiki.

## Was darunter liegt

Die fünf Apps sind Clients. Die gemeinsame Schicht macht Whitelabel erst möglich.

### Multi-Tenancy

Jeder Creator (oder jede Agentur-Kundenmarke) ist ein **Tenant**. Traffic wird über den Host aufgelöst. Nur verifizierte Domains binden Anfragen. JWT und Host müssen denselben Tenant ergeben, sonst `403 TENANT_MISMATCH`.

Technisch:

- Shared Schema in PostgreSQL, Zeilen mit `tenant_id`
- Hibernate-Filter und Write-Guards
- Users global, Zugehörigkeit über `tenant_memberships`
- Domain-Verifikation per DNS-TXT (`directwerk-verify=…`)
- In Produktion Wildcard-Hosts wie `*.directwerk.org` über Coolify

Zweiter Creator, gleiche Infrastruktur, kein zweites Deployment. Genau das hat das Liedermacherleben-Setup gezeigt.

### Module

Nicht jeder Tenant braucht alles. Module schalten Fähigkeiten frei, ohne den Code zu forken:

```
DIGITAL_CONTENT  →  PODCAST  →  PODCAST_RSS  →  FEED_BUILDER
                 →  ARTICLES →  ARTICLE_RSS  →  …
                 →  BONUS_CONTENT
```

Fehlt ein Modul, antwortet die öffentliche Oberfläche mit `403 FEATURE_NOT_ENABLED`.

### Zugriffe: FREE vs PAID

1. **Content-Gate:** `accessPolicy` ist `FREE` oder `PAID`
2. **Entitlement-Gate** nur bei `PAID`: Union aller aktiven Abos

Zwei Produkttypen:

- **LEVEL** – Stufenleiter über `sortOrder`
- **PACKAGE** – Bundles über Regeln (Serie, Format, Kategorie, …)

Die Rolle `SUBSCRIBER` bedeutet nur „kann sich anmelden“. Freigeschaltet ist, was die aktiven Subscriptions hergeben.

### RSS und Assets

Öffentliche Feeds tragen freie Inhalte (Apple, Spotify, Fyyd, …). Private Feeds sind tokenisierte URLs pro Abonnent mit Entitlement-Filter. Der optionale Feed-Builder filtert Formate; der Entitlement-Filter bleibt aktiv.

Audio und Dateien liegen in S3-kompatiblem EU-Storage, Keys tenant-präfixiert. Private Bytes nur über signierte URLs nach Entitlement-Check.

### Stack

| Bereich | Technik |
|--------|---------|
| API | Java 21, Spring Boot 4.1, Gradle |
| Daten | PostgreSQL, Flyway |
| Auth | OAuth2 Resource Server / Auth Server, JWT mit `tenant_id` |
| Jobs / Mail | Postgres-Queue, Mailpit lokal |
| Frontends | Next.js, shared UI-Paket `@directwerk/ui` |
| Docs | VitePress + exportierte OpenAPI |
| Billing | Stripe Connect (Scaffold), Patreon/Steady als Sync-Pfad |
| Betrieb | Docker, Coolify auf Hetzner |

Jede Fähigkeit hat einen REST-Endpunkt. Studio, Web und Admin sind Clients derselben API. Fehler tragen strukturierte `code`-Felder. Bruno und `.http`-Harness bleiben mit Controllern synchron.

## Was schon steht, was noch kommt

**Alpha / vorhanden:** Multi-Tenancy, Module, Admin/Studio/Web/Docs/Homepage, Podcast-Domain, öffentliches und privates RSS, Entitlements, Asset-Storage, Stripe-Scaffold, Wildcard-Onboarding wie bei Liedermacherleben.

**Danach u. a.:** härteres Stripe-Billing, Patreon/Steady-Migration, Artikel-Desk ausbauen, Plattform-SaaS-Billing, E-Mail-Alerts, Outbound-Webhooks, GDPR-Export/Delete.

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
- Öffentliche Doku: `directwerk-docs/`
- Marketing-Site: `homepage/`

---

*Draft für einen deutschen Blog-Post. Ton: Showcase + Erklärung. Bitte vor Veröffentlichung Domain/Links, Launch-Status und konkrete Demo-URLs einsetzen.*
