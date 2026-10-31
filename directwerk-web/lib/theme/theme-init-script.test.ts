import {describe, expect, it} from 'vitest'

import {WEB_THEME_STORAGE_KEY, themeInitScript} from '@/lib/theme/theme-init-script'

describe('themeInitScript', () => {
    it('emits a bootstrap script that mirrors the default storage key', () => {
        const script = themeInitScript()
        expect(script).toContain(WEB_THEME_STORAGE_KEY)
        expect(script).toContain('prefers-color-scheme: dark')
        expect(script).toContain('classList.add')
    })

    it('emits a bootstrap script that mirrors a custom storage key', () => {
        const script = themeInitScript('custom-key')
        expect(script).toContain('custom-key')
        expect(script).not.toContain(WEB_THEME_STORAGE_KEY)
    })
})
