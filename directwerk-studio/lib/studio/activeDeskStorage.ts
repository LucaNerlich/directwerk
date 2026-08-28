import type {StudioDesk} from '@directwerk/api/types'

const STORAGE_KEY = 'directwerk-studio:last-desk'

export function getLastActiveDesk(): StudioDesk | null {
    if (typeof window === 'undefined') {
        return null
    }
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    if (value === 'WRITE' || value === 'PODCAST') {
        return value
    }
    return null
}

export function setLastActiveDesk(desk: StudioDesk): void {
    if (typeof window === 'undefined') {
        return
    }
    window.sessionStorage.setItem(STORAGE_KEY, desk)
}
