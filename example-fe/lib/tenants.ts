export const TENANTS = [
    {
        host: 'alpha-a.localhost',
        label: 'Tenant A',
        slug: 'alpha-show-a',
    },
    {
        host: 'alpha-b.localhost',
        label: 'Tenant B',
        slug: 'alpha-show-b',
    },
] as const

export type TenantHost = (typeof TENANTS)[number]['host']

export function parseTenantHost(value: string | null): TenantHost | null {
    const tenant = TENANTS.find(({host}) => host === value)

    return tenant?.host ?? null
}

export function getTenant(host: TenantHost): (typeof TENANTS)[number] {
    return TENANTS.find((tenant) => tenant.host === host) ?? TENANTS[0]
}
