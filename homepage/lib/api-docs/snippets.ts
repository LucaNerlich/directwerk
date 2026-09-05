export const SITE_CONFIG_CURL = `curl -sS \\
  -H "Host: podcast.beispiel.de" \\
  https://api.directwerk.org/api/v1/public/site-config`

export const OAUTH_TOKEN_CURL = `curl -sS -X POST \\
  -H "Host: podcast.beispiel.de" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=password&username=hoerer@beispiel.de&password=***&client_id=directwerk-tenant-frontend" \\
  https://api.directwerk.org/oauth2/token
  # Hinweis: Password-Grant nur lokal/dev. Produktion nutzt Authorization Code. Siehe Integrationsguide /docs/api/integration.`
