import {describe, expect, it} from 'vitest'

import {defaultHomePath, deskHome, hasDesk, hasModule, resolveActiveDesk} from '@/lib/api/client'
import type {SiteConfig} from '@directwerk/api/types'

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
        expect(defaultHomePath('WRITE_DESK')).toBe('/write')
        expect(defaultHomePath('PODCAST_DESK')).toBe('/podcast')
        expect(defaultHomePath('OVERVIEW')).toBe('/')
    })

    it('maps desks to their home paths', () => {
        expect(deskHome('WRITE')).toBe('/write')
        expect(deskHome('PODCAST')).toBe('/podcast')
    })

    it('resolves active desk from pathname and config', () => {
        expect(resolveActiveDesk('/write', sampleConfig)).toBe('WRITE')
        expect(resolveActiveDesk('/write/articles', sampleConfig)).toBe('WRITE')
        expect(resolveActiveDesk('/write/bonus', sampleConfig)).toBe('WRITE')
        expect(resolveActiveDesk('/podcast', sampleConfig)).toBe('PODCAST')
        expect(resolveActiveDesk('/podcast/episodes', sampleConfig)).toBe('PODCAST')
        expect(resolveActiveDesk('/podcast/series', sampleConfig)).toBe('PODCAST')
        expect(resolveActiveDesk('/', sampleConfig)).toBeNull()
        expect(resolveActiveDesk('/media', sampleConfig)).toBeNull()
        expect(resolveActiveDesk('/settings/branding', sampleConfig)).toBeNull()
    })

    it('falls back to single desk for single-desk tenants on shared routes', () => {
        const podcastOnly: SiteConfig = {
            ...sampleConfig,
            studioDesks: ['PODCAST'],
        }
        const writeOnly: SiteConfig = {
            ...sampleConfig,
            studioDesks: ['WRITE'],
        }

        expect(resolveActiveDesk('/media', podcastOnly)).toBe('PODCAST')
        expect(resolveActiveDesk('/', podcastOnly)).toBe('PODCAST')
        expect(resolveActiveDesk('/write/articles', podcastOnly)).toBeNull()

        expect(resolveActiveDesk('/media', writeOnly)).toBe('WRITE')
        expect(resolveActiveDesk('/', writeOnly)).toBe('WRITE')
        expect(resolveActiveDesk('/podcast', writeOnly)).toBeNull()
    })

    it('returns null when studioDesks is empty', () => {
        const noDesks: SiteConfig = {
            ...sampleConfig,
            studioDesks: [],
        }
        expect(resolveActiveDesk('/write/articles', noDesks)).toBeNull()
        expect(resolveActiveDesk('/podcast', noDesks)).toBeNull()
        expect(resolveActiveDesk('/', noDesks)).toBeNull()
    })
})
