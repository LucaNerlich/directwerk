import {directwerkFetch, getOAuthClientId} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenants'
import {jsonError, toClientResponse} from '@/lib/api/upstream'
import {parseJsonText, parseRefreshTokenInput, readBoundedBody} from '@/lib/api/validation'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const bodyText = await readBoundedBody(request.body)
    if (bodyText === null) {
        return jsonError('The request body is invalid.', 400)
    }

    const input = parseRefreshTokenInput(parseJsonText(bodyText))
    if (input === null) {
        return jsonError('A valid refresh token is required.', 400)
    }

    try {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: input.refresh_token,
            client_id: getOAuthClientId(),
        })
        const response = await directwerkFetch({
            path: '/oauth2/token',
            tenantHost,
            method: 'POST',
            body: body.toString(),
            contentType: 'application/x-www-form-urlencoded',
            useOAuthClient: true,
        })

        const clientResponse = await toClientResponse(response)
        clientResponse.headers.set('Cache-Control', 'no-store')
        clientResponse.headers.set('Pragma', 'no-cache')
        return clientResponse
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
