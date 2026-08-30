import {NextResponse} from 'next/server'

import {parseTenantHost} from '@directwerk/api/proxy'
import {
    serializeClearTenantHostCookie,
    serializeTenantHostCookie,
} from '@directwerk/api/tenant'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation/catalog'

import {directwerkFetch} from '@/lib/server/api'

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

async function readUpstreamJson(response: Response): Promise<unknown | null> {
    const text = await response.text()
    if (text.length === 0) {
        return null
    }

    try {
        return JSON.parse(text) as unknown
    } catch {
        return null
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        let body: SelectTenantBody
        try {
            body = (await request.json()) as SelectTenantBody
        } catch {
            return jsonError('Ungültige Anfrage.', 400)
        }

        const tenantHost = parseTenantHost(
            typeof body.host === 'string' ? body.host : null,
        )
        if (tenantHost === null) {
            return jsonError('Bitte eine gültige Mandanten-Domain eingeben.', 400)
        }

        let upstream: Response
        try {
            upstream = await directwerkFetch({
                path: '/api/v1/public/site-config',
                tenantHost,
                method: 'GET',
            })
        } catch {
            return jsonError(
                'Der Mandant konnte gerade nicht geprüft werden. Bitte erneut versuchen.',
                502,
            )
        }

        if (upstream.status === 404) {
            return jsonError(
                'Für diese Domain ist kein Mandant eingerichtet.',
                404,
            )
        }

        if (!upstream.ok) {
            return jsonError(
                'Der Mandant konnte gerade nicht geprüft werden. Bitte erneut versuchen.',
                502,
            )
        }

        const value = await readUpstreamJson(upstream)
        const parsed = value === null ? null : parseStudioSiteConfigEnvelope(value)
        if (parsed === null) {
            return jsonError('Ungültige Antwort vom Server.', 502)
        }

        const response = NextResponse.json({tenant: parsed.data.tenant})
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

export async function DELETE(): Promise<NextResponse> {
    const response = NextResponse.json({ok: true})
    response.headers.append(
        'Set-Cookie',
        serializeClearTenantHostCookie(cookieSecure()),
    )
    return response
}
