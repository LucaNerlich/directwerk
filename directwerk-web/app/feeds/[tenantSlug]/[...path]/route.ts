import {fetchTenantFeed} from '@/lib/server/feedProxy'

interface RouteContext {
    params: Promise<{tenantSlug: string; path: string[]}>
}

export async function GET(request: Request, {params}: RouteContext): Promise<Response> {
    const tenantHost = request.headers.get('host')
    if (tenantHost === null) {
        return new Response(null, {status: 400})
    }

    const {tenantSlug, path} = await params
    return fetchTenantFeed(tenantSlug, path, tenantHost)
}

export const HEAD = GET
