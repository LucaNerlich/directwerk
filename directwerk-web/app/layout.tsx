import type {ReactNode} from 'react'

import {headers} from 'next/headers'

import {ThemeProvider} from '@/components/theme-provider'
import {defaultLocale, isLocale} from '@/lib/i18n/config'
import {themeInitScript} from '@/lib/theme/theme-init-script'

import './globals.css'

/**
 * Root shell only. Tenant chrome, auth, and dictionaries live under
 * `app/[lang]/layout.tsx`. Route handlers (`/api/**`, `/feeds/**`) share this
 * minimal document wrapper without locale UI.
 */
export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode
}>): Promise<React.JSX.Element> {
    // #341: proxy.ts stamps the locale for locale-prefixed paths, so server-rendered /en documents
    // declare lang="en" (previously every document said "de" and a client effect corrected it,
    // which left no-JS and crawler-rendered pages with the wrong language).
    const fromProxy = (await headers()).get('x-locale')
    const locale = fromProxy !== null && isLocale(fromProxy) ? fromProxy : defaultLocale
    // Proxy forwards the CSP script nonce on every request (see directwerkProxy).
    const nonce = (await headers()).get('x-nonce') ?? undefined

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Parse-blocking: applies .dark/.light before first paint (FOUC). */}
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{__html: themeInitScript()}}
                />
            </head>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    )
}
