import {describe, expect, it} from 'vitest'

import {loginHref} from './loginHref'

describe('loginHref', () => {
    it('builds a locale login URL with encoded returnTo', () => {
        expect(loginHref('de', '/de/downloads')).toBe(
            '/de/login?returnTo=%2Fde%2Fdownloads',
        )
        expect(loginHref('en', '/en/episodes/folge-1')).toBe(
            '/en/login?returnTo=%2Fen%2Fepisodes%2Ffolge-1',
        )
    })
})
