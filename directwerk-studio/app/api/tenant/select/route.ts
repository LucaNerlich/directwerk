import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'

import {parseTenantHost} from '@directwerk/api/proxy'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation/catalog'
import {TENANT_HOST_COOKIE} from '@directwerk/api/tenant'

import {directwerkFetch} from '@/lib/server/api'

interface SelectTenantBody {
    host?: unknown
}

function jsonError(message: string, status: number): NextResponse {
    return NextResponse.json({error: message}, {status})
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const response = await directwerkFetch({
        path: '/api/v1/public/site-config',
        tenantHost,
        method: 'GET',
    })

    if (response.status === 404) {
        return jsonError(
            'Für diese Domain ist kein Mandant eingerichtet.',
            404,
        )
    }

    if (!response.ok) {
        return jsonError(
            'Der Mandant konnte gerade nicht geprüft werden. Bitte erneut versuchen.',
            502,
        )
    }

    const value: unknown = await response.json()
    const parsed = parseStudioSiteConfigEnvelope(value)
    if (parsed === null) {
        return jsonError('Ungültige Antwort vom Server.', 502)
    }

    const cookieStore = await cookies()
    cookieStore.set(TENANT_HOST_COOKIE, tenantHost, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false,
    })

    return NextResponse.json({
        tenant: parsed.data.tenant,
        redirectTo: '/login',
    })
}

export async function DELETE(): Promise<NextResponse> {
    const cookieStore = await cookies()
    cookieStore.delete(TENANT_HOST_COOKIE)
    return NextResponse.json({ok: true})
}
