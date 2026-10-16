import {describe, expect, it} from 'vitest'

import nextConfig from './next.config'

describe('studio next config (#559)', () => {
    it('keeps the imprint on its own origin', async () => {
        const redirects = (await nextConfig.redirects?.()) ?? []
        const imprint = redirects.filter((rule) => rule.source.includes('imprint'))

        // The in-app [lang]/imprint route must win; an off-domain bounce made the localized
        // legal page unreachable and sent users to the vendor's personal site.
        expect(imprint).toEqual([])
        expect(redirects.some((rule) => String(rule.destination).includes('lucanerlich.com'))).toBe(false)
    })
})
