type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiHighlight {
    method: HttpMethod
    path: string
    description: string
}

export const API_HIGHLIGHTS: readonly ApiHighlight[] = [
    {
        method: 'GET',
        path: '/api/v1/public/site-config',
        description: 'Branding und aktive Module — Startpunkt für jedes Frontend.',
    },
    {
        method: 'GET',
        path: '/api/v1/public/episodes',
        description: 'Öffentlicher Katalog (FREE spielbar; PAID nur Metadaten, audioCdnUrl = null).',
    },
    {
        method: 'GET',
        path: '/api/v1/public/products',
        description: 'Mitgliedschaftsprodukte und Preise für die Pricing-Seite.',
    },
    {
        method: 'GET',
        path: '/feeds/{tenantSlug}/podcast.xml',
        description: 'Öffentlicher RSS-Feed für Podcatcher (mandantenbezogen wie die API).',
    },
    {
        method: 'GET',
        path: '/feeds/{tenantSlug}/u/{feedToken}.xml',
        description: 'Privater Abonnenten-Feed (tokenisierte URL).',
    },
    {
        method: 'POST',
        path: '/oauth2/token',
        description: 'OAuth2-Token für Publisher- und Abonnenten-JWTs.',
    },
    {
        method: 'GET',
        path: '/api/v1/me/episodes',
        description: 'Berechtigte Episoden für eingeloggte Abonnenten.',
    },
    {
        method: 'POST',
        path: '/api/v1/me/billing/checkout-sessions',
        description: 'Stripe-Checkout — Billing vollständig über die API.',
    },
]

export const INTEGRATOR_BULLETS = [
    'Mandant über verifizierten Host-Header (kein X-Tenant-Id).',
    'Öffentliche Inhalte unter GET /api/v1/public/* ohne Authentifizierung.',
    'Geschützte Flows mit OAuth2-JWT über POST /oauth2/token.',
] as const

export const RESPONSE_ENVELOPE_EXAMPLE = `{
  "statusCode": 200,
  "statusMessage": "OK",
  "data": { "tenant": { "slug": "beispiel" }, "enabledModules": ["PODCAST"] },
  "errors": [],
  "metadata": {}
}`

export const ERROR_EXAMPLE = `{
  "statusCode": 403,
  "statusMessage": "Forbidden",
  "data": null,
  "errors": [{ "code": "FEATURE_NOT_ENABLED", "message": "Module PODCAST_RSS is not active" }],
  "metadata": {}
}`
