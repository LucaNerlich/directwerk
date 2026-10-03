type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiHighlight {
    method: HttpMethod
    path: string
    description: string
}

/** Structural examples only — localized descriptions live in dictionaries. */
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
