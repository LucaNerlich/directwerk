import {directwerkFetch} from '@/lib/server/api'
import {jsonError, toClientResponse} from '@directwerk/api/proxy'
import {readBoundedBody} from '@directwerk/api/proxy'
import {parseResetPasswordInput} from '@directwerk/api/validation/input'
import {parseJsonText} from '@directwerk/api/validation/json'

export async function POST(request: Request): Promise<Response> {
    const bodyText = await readBoundedBody(request.body)
    if (bodyText === null) {
        return jsonError('The request body is invalid.', 400)
    }

    const input = parseResetPasswordInput(parseJsonText(bodyText))
    if (input === null) {
        return jsonError(
            'A valid reset token and a password of at least 12 characters are required.',
            400,
        )
    }

    try {
        const response = await directwerkFetch({
            path: '/api/v1/auth/reset-password',
            method: 'POST',
            body: JSON.stringify(input),
            contentType: 'application/json',
        })

        return toClientResponse(response)
    } catch {
        return jsonError('The upstream service is unavailable.', 502)
    }
}
