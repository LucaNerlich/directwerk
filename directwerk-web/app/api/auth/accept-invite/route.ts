import {directwerkFetch} from '@/lib/server/api'
import {jsonError, toClientResponse} from '@directwerk/api/proxy'
import {readBoundedBody} from '@directwerk/api/proxy'
import {parseAcceptInviteInput, parseJsonText} from '@directwerk/api/validation'

export async function POST(request: Request): Promise<Response> {
    const bodyText = await readBoundedBody(request.body)
    if (bodyText === null) {
        return jsonError('The request body is invalid.', 400, 'INVALID_REQUEST_BODY')
    }

    const input = parseAcceptInviteInput(parseJsonText(bodyText))
    if (input === null) {
        return jsonError(
            'A valid invite token and a password of at least 12 characters are required.',
            400,
            'INVALID_ACCEPT_INVITE_INPUT',
        )
    }

    try {
        const response = await directwerkFetch({
            path: '/api/v1/auth/accept-invite',
            method: 'POST',
            body: JSON.stringify(input),
            contentType: 'application/json',
        })

        return toClientResponse(response)
    } catch {
        return jsonError(
            'The upstream service is unavailable.',
            502,
            'UPSTREAM_UNAVAILABLE',
        )
    }
}
