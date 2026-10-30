import type {StudioDesk} from '@directwerk/api/types'

/** Tenant-scoped localStorage key for the last Write/Podcast desk. */
export const LAST_DESK_KEY_PREFIX = 'dw.studio.lastDesk'

/** Pre-localStorage session key — still read once for same-tab continuity. */
const LEGACY_SESSION_KEY = 'directwerk-studio:last-desk'

export type DeskStorageScope = {
    tenantId?: number | null
    tenantSlug?: string | null
}

function parseDesk(value: string | null): StudioDesk | null {
    if (value === 'WRITE' || value === 'PODCAST') {
        return value
    }
    return null
}

/**
 * Resolves the preferred storage key for a tenant.
 * Prefers numeric tenant id; falls back to slug; then a global key.
 */
export function lastDeskStorageKey(scope: DeskStorageScope = {}): string {
    if (scope.tenantId != null && Number.isFinite(scope.tenantId) && scope.tenantId > 0) {
        return `${LAST_DESK_KEY_PREFIX}:${scope.tenantId}`
    }
    if (scope.tenantSlug != null && scope.tenantSlug.length > 0) {
        return `${LAST_DESK_KEY_PREFIX}:slug:${scope.tenantSlug}`
    }
    return LAST_DESK_KEY_PREFIX
}

function readLocal(key: string): StudioDesk | null {
    if (typeof window === 'undefined') {
        return null
    }
    try {
        return parseDesk(window.localStorage.getItem(key))
    } catch {
        return null
    }
}

function writeLocal(key: string, desk: StudioDesk): void {
    if (typeof window === 'undefined') {
        return
    }
    try {
        window.localStorage.setItem(key, desk)
    } catch {
        // Quota / private mode — preference is best-effort.
    }
}

function readLegacySession(): StudioDesk | null {
    if (typeof window === 'undefined') {
        return null
    }
    try {
        return parseDesk(window.sessionStorage.getItem(LEGACY_SESSION_KEY))
    } catch {
        return null
    }
}

function clearLegacySession(): void {
    if (typeof window === 'undefined') {
        return
    }
    try {
        window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
    } catch {
        // ignore
    }
}

/**
 * Returns the last active desk for the given tenant scope.
 * Checks id key, then slug key, then legacy sessionStorage.
 */
export function getLastActiveDesk(scope: DeskStorageScope = {}): StudioDesk | null {
    const primaryKey = lastDeskStorageKey(scope)
    const fromPrimary = readLocal(primaryKey)
    if (fromPrimary !== null) {
        return fromPrimary
    }

    // Prefer id key, but still honor a slug-scoped value until migrated.
    if (scope.tenantId != null && scope.tenantSlug != null && scope.tenantSlug.length > 0) {
        const fromSlug = readLocal(lastDeskStorageKey({tenantSlug: scope.tenantSlug}))
        if (fromSlug !== null) {
            writeLocal(primaryKey, fromSlug)
            return fromSlug
        }
    }

    const fromLegacy = readLegacySession()
    if (fromLegacy !== null) {
        writeLocal(primaryKey, fromLegacy)
        clearLegacySession()
        return fromLegacy
    }

    return null
}

/**
 * Persists the last active desk for the tenant scope in localStorage.
 */
export function setLastActiveDesk(desk: StudioDesk, scope: DeskStorageScope = {}): void {
    writeLocal(lastDeskStorageKey(scope), desk)
    clearLegacySession()
}
