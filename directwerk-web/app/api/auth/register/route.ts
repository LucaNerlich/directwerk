import {directwerkFetch} from '@/lib/server/api'
import {parseTenantHost} from '@directwerk/api/proxy'
import {jsonError, toClientResponse} from '@directwerk/api/proxy'
import {readBoundedBody} from '@directwerk/api/proxy'
import {parseRegisterInput} from '@directwerk/api/validation/input'
import {parseJsonText} from '@directwerk/api/validation/json'

export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const bodyText = await readBoundedBody(request.body)
    if (bodyText === null) {
        return jsonError('The request body is invalid.', 400)
    }

    const input = parseRegisterInput(parseJsonText(bodyText))
    if (input === null) {
        return jsonError('Valid email, password, and optional name are required.', 400)
    }

    try {
        const response = await directwerkFetch({
            path: '/api/v1/auth/register',
            tenantHost,
            method: 'POST',
            body: JSON.stringify(input),
            contentType: 'application/json',
        })

        return toClientResponse(response)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
