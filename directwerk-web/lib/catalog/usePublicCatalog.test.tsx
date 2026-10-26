import {cleanup, renderHook} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {ReactNode} from 'react'

import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {LocaleProvider} from '@/lib/i18n/LocaleProvider'
import {testDictionary} from '@/lib/i18n/testDictionary'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

import type {PublicSiteConfig} from '@directwerk/api/types'

const siteConfig = {enabledModules: ['PODCAST']} as PublicSiteConfig

function wrapper({children}: {children: ReactNode}): React.JSX.Element {
    return (
        <LocaleProvider lang="de" dictionary={testDictionary}>
            <SiteConfigProvider config={siteConfig}>{children}</SiteConfigProvider>
        </LocaleProvider>
    )
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('usePublicCatalog', () => {
    it('skips public fetch when anonymous SSR seed is present', () => {
        const loadPublic = vi.fn()
        const loadMine = vi.fn()
        const initialItems = [{id: 1}]

        const {result} = renderHook(
            () =>
                usePublicCatalog({
                    tenantHost: 'tenant.example',
                    isAuthenticated: false,
                    authRequiredMessage: 'auth',
                    loadErrorMessage: 'fail',
                    loadMine,
                    loadPublic,
                    initialItems,
                }),
            {wrapper},
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.items).toEqual(initialItems)
        expect(loadPublic).not.toHaveBeenCalled()
        expect(loadMine).not.toHaveBeenCalled()
    })
})
