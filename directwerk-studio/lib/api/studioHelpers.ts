export function suggestSlug(title: string): string {
    return title
        .trim()
        .replace(/ä/gi, 'ae')
        .replace(/ö/gi, 'oe')
        .replace(/ü/gi, 'ue')
        .replace(/ẞ/g, 'ß')
        .replace(/ß/g, 'ss')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63)
}

export function isEditorRole(roles: string[]): boolean {
    return roles.includes('EDITOR') || roles.includes('TENANT_ADMIN')
}

export function isTenantAdminRole(roles: string[]): boolean {
    return roles.includes('TENANT_ADMIN')
}
