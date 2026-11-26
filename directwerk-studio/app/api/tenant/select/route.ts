import {NextResponse} from 'next/server'

import {parseTenantHost, readBoundedRequestBody} from '@directwerk/api/proxy'
import {isSameOriginRequest} from '@directwerk/api/server'
import {
    serializeClearTenantHostCookie,
    serializeTenantHostCookie,
} from '@directwerk/api/tenant'

export const dynamic = 'force-dynamic'

interface SelectTenantBody {
    host?: unknown
}

function jsonError(message: string, status: number): NextResponse {
    return NextResponse.json({error: message}, {status})
}

function cookieSecure(): boolean {
    return process.env.NODE_ENV === 'production'
}

function rejectCrossOriginOrNonJson(request: Request): NextResponse | null {
    if (!isSameOriginRequest(request)) {
        return new NextResponse(null, {status: 403})
    }
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('application/json')) {
        return jsonError('Content-Type must be application/json.', 415)
    }
    return null
}

export async function POST(request: Request): Promise<NextResponse> {
    const rejected = rejectCrossOriginOrNonJson(request)
    if (rejected !== null) {
        return rejected
    }

    try {
        const bounded = await readBoundedRequestBody(request, 4_096)
        if (!bounded.ok) {
            return jsonError(bounded.error, bounded.status)
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(bounded.text)
        } catch {
            return jsonError('Ungültige Anfrage.', 400)
        }
        if (parsed === null || typeof parsed !== 'object') {
            return jsonError('Ungültige Anfrage.', 400)
        }
        const host = (parsed as SelectTenantBody).host

        const tenantHost = parseTenantHost(
            typeof host === 'string' ? host : null,
        )
        if (tenantHost === null) {
            return jsonError('Bitte eine gültige Mandanten-Domain eingeben.', 400)
        }

        const response = NextResponse.json({ok: true})
        response.headers.append(
            'Set-Cookie',
            serializeTenantHostCookie(tenantHost, cookieSecure()),
        )
        return response
    } catch {
        return jsonError(
            'Der Workspace konnte gerade nicht ausgewählt werden. Bitte erneut versuchen.',
            500,
        )
    }
}

export async function DELETE(request: Request): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return new NextResponse(null, {status: 403})
    }
    const response = NextResponse.json({ok: true})
    response.headers.append(
        'Set-Cookie',
        serializeClearTenantHostCookie(cookieSecure()),
    )
    return response
}
