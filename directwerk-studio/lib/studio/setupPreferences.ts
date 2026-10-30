const DISMISS_KEY = 'dw.studio.tenantSetup.dismissed'
const SHOW_OPS_KEY = 'dw.studio.showOps'

function readFlag(key: string): boolean {
    if (typeof window === 'undefined') {
        return false
    }
    try {
        return window.localStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

function writeFlag(key: string, value: boolean): void {
    if (typeof window === 'undefined') {
        return
    }
    try {
        if (value) {
            window.localStorage.setItem(key, '1')
        } else {
            window.localStorage.removeItem(key)
        }
    } catch {
        // Ignore quota / private-mode failures — preference is best-effort.
    }
}

export function isTenantSetupDismissed(): boolean {
    return readFlag(DISMISS_KEY)
}

export function setTenantSetupDismissed(dismissed: boolean): void {
    writeFlag(DISMISS_KEY, dismissed)
}

export function isShowOpsPreferred(): boolean {
    return readFlag(SHOW_OPS_KEY)
}

export function setShowOpsPreferred(show: boolean): void {
    writeFlag(SHOW_OPS_KEY, show)
}
