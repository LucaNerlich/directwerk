export const SITE_CONFIG_CURL = `curl -sS \\
  -H "Host: podcast.beispiel.de" \\
  https://api.directwerk.de/api/v1/public/site-config`

export const OAUTH_TOKEN_CURL = `curl -sS -X POST \\
  -H "Host: podcast.beispiel.de" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=password&username=hoerer@beispiel.de&password=***&client_id=directwerk-web" \\
  https://api.directwerk.de/oauth2/token`
