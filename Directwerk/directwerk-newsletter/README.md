# directwerk-newsletter

Write desk vertical slice for Directwerk: **newsletter / article publications** — blog posts,
paid essays, and classic email newsletters.

A post published on the tenant site and a newsletter issue sent to inboxes are the **same
publication** (`Article`), with different **delivery channels**:

| Channel | Module / mechanism | Notes |
|---------|-------------------|-------|
| **Web** | This module + public API | Substack-style archive, SEO, paid body gating |
| **Email** | `EMAIL_NOTIFY` + `directwerk-email` | Optional on publish; excerpt or full body |

| Concern | Module / gate |
|---------|----------------|
| Article CRUD + publish workflow | This module |
| Feature flag for write ops | `DIGITAL_CONTENT` (`DigitalContentModule.KEY`) |
| Shared taxonomy | `Category` in `directwerk-digital` |
| Send to subscribers on publish | `EMAIL_NOTIFY` (transport in `directwerk-email`) |

Companion: [`../directwerk-podcast/README.md`](../directwerk-podcast/README.md) (Podcast desk).
