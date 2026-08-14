import {describe, expect, it} from 'vitest'

import {defaultHomePath, hasModule} from '@/lib/api/client'
import type {SiteConfig} from '@/lib/api/types'

const sampleConfig: SiteConfig = {
    tenant: {slug: 'alpha', name: 'Alpha'},
    enabledModules: ['DIGITAL_CONTENT', 'PODCAST'],
    branding: {
        siteTitle: null,
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
    },
    publicRssUrl: null,
    studioHome: 'OVERVIEW',
    studioDesks: ['WRITE', 'PODCAST'],
    emailNotifyAvailable: false,
}

describe('site helpers', () => {
    it('detects enabled modules', () => {
        expect(hasModule(sampleConfig, 'PODCAST')).toBe(true)
        expect(hasModule(sampleConfig, 'SUBSCRIPTION')).toBe(false)
    })

    it('maps studio home to default paths', () => {
        expect(defaultHomePath('WRITE_DESK')).toBe('/write/articles')
        expect(defaultHomePath('PODCAST_DESK')).toBe('/podcast')
        expect(defaultHomePath('OVERVIEW')).toBe('/')
    })
})
