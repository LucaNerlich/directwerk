import {readBearerToken} from '@/lib/api/proxy'
import {jsonError, toClientResponse} from '@/lib/api/upstream'
import {directwerkFetch} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenants'

export async function GET(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const bearerToken = readBearerToken(request.headers.get('authorization'))
    if (bearerToken === null) {
        return jsonError('A valid bearer token is required.', 401)
    }

    try {
        const response = await directwerkFetch({
            path: '/api/v1/media?assetType=IMAGE',
            tenantHost,
            method: 'GET',
            bearerToken,
        })

        return toClientResponse(response)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
