'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {PublicSiteConfig} from '@directwerk/api/types'

const SiteConfigContext = createContext<PublicSiteConfig | null>(null)

export function SiteConfigProvider({
    config,
    children,
}: {
    config: PublicSiteConfig
    children: ReactNode
}) {
    return (
        <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>
    )
}

export function useSiteConfig(): PublicSiteConfig {
    const config = useContext(SiteConfigContext)
    if (!config) {
        throw new Error('SiteConfigProvider is missing')
    }
    return config
}
