'use client'

import {createContext, useContext, type ReactNode} from 'react'

export function createSiteConfigProvider<T>() {
    const SiteConfigContext = createContext<T | null>(null)

    function SiteConfigProvider({
        config,
        children,
    }: {
        config: T
        children: ReactNode
    }) {
        return (
            <SiteConfigContext.Provider value={config}>
                {children}
            </SiteConfigContext.Provider>
        )
    }

    function useSiteConfig(): T {
        const config = useContext(SiteConfigContext)
        if (!config) {
            throw new Error('SiteConfigProvider is missing')
        }
        return config
    }

    return {SiteConfigProvider, useSiteConfig}
}
