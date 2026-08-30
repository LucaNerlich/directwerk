import {readBoundedBody} from '@directwerk/api/proxy/boundedBody'
import {jsonError, toClientResponse} from '@directwerk/api/proxy/upstreamResponse'
import {parseLoginInput} from '@directwerk/api/validation/input'
import {parseJsonText} from '@directwerk/api/validation/json'

import {directwerkFetch} from '@/lib/server/api'

export async function POST(request: Request): Promise<Response> {
    const bodyText = await readBoundedBody(request.body)
    if (bodyText === null) {
        return jsonError('The request body is invalid.', 400)
    }

    const input = parseLoginInput(parseJsonText(bodyText))
    if (input === null) {
        return jsonError('A valid email and password are required.', 400)
    }

    try {
        const response = await directwerkFetch({
            path: '/api/v1/auth/studio/workspaces',
            method: 'POST',
            body: JSON.stringify({
                email: input.email,
                password: input.password,
            }),
            contentType: 'application/json',
        })

        return toClientResponse(response)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
