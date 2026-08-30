import {NextResponse} from 'next/server'

import {parseTenantHost} from '@directwerk/api/proxy'
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

export async function DELETE(): Promise<NextResponse> {
    const response = NextResponse.json({ok: true})
    response.headers.append(
        'Set-Cookie',
        serializeClearTenantHostCookie(cookieSecure()),
    )
    return response
}
