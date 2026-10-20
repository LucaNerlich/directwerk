import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReactNode} from 'react'

import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

import type {PublicSiteConfig} from '@directwerk/api/types'

const siteConfig: PublicSiteConfig = {
    enabledModules: ['PODCAST_RSS', 'ARTICLE_RSS'],
} as PublicSiteConfig

function wrapper({children}: {children: ReactNode}): React.JSX.Element {
    return <SiteConfigProvider config={siteConfig}>{children}</SiteConfigProvider>
}

const loadMine = vi.fn()
const loadPublic = vi.fn()
const loadSeries = vi.fn()

function options(overrides: {isAuthenticated?: boolean; loadSeries?: () => Promise<string[]>} = {}) {
    return {
        tenantHost: 'tenant.example',
        isAuthenticated: false,
        authRequiredMessage: 'Bitte anmelden',
        loadErrorMessage: 'Laden fehlgeschlagen',
        loadMine,
        loadPublic,
        ...overrides,
    }
}

beforeEach(() => {
    loadMine.mockResolvedValue(['mine'])
    loadPublic.mockResolvedValue(['public'])
    loadSeries.mockResolvedValue(['series'])
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('usePublicCatalog', () => {
    it('loads the public list and skips the optional series loader', async () => {
        const {result} = renderHook(() => usePublicCatalog(options()), {wrapper})

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.siteConfig).toBe(siteConfig)
        expect(result.current.items).toEqual(['public'])
        expect(result.current.series).toEqual([])
        expect(loadMine).not.toHaveBeenCalled()
    })

    it('loads the entitled list and the series for a signed-in reader', async () => {
        const {result} = renderHook(
            () => usePublicCatalog(options({isAuthenticated: true, loadSeries})),
            {wrapper},
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.items).toEqual(['mine'])
        expect(result.current.series).toEqual(['series'])
        expect(loadPublic).not.toHaveBeenCalled()
    })

    it('maps AUTH_REQUIRED to the page message', async () => {
        loadPublic.mockRejectedValue(new Error('AUTH_REQUIRED'))

        const {result} = renderHook(() => usePublicCatalog(options()), {wrapper})

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.errorMessage).toBe('Bitte anmelden')
        expect(result.current.items).toEqual([])
    })
})
