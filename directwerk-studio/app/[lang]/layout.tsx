import type {Metadata} from 'next'
import Script from 'next/script'
import {connection} from 'next/server'

import UmamiAnalytics from '@directwerk/ui/components/umami-analytics'

import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import {ThemeProvider, themeInitScript} from '@/components/theme-provider'
import {assertLocale, getDictionary, locales} from '@/lib/i18n'

export async function generateStaticParams() {
    return locales.map((lang) => ({lang}))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang} = await params
    const dictionary = await getDictionary(lang)
    return {
        title: dictionary.meta.productName,
        description:
            lang === 'en'
                ? 'Creator dashboard for Directwerk publishers'
                : 'Creator-Dashboard für Directwerk-Publisher',
        alternates: {
            languages: {
                de: '/de',
                en: '/en',
            },
        },
    }
}

export default async function LangLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode
    params: Promise<{lang: string}>
}>) {
    await connection()
    const {lang: langParam} = await params
    const lang = assertLocale(langParam)
    const dictionary = await getDictionary(lang)

    return (
        <html lang={lang} suppressHydrationWarning>
            <body className="min-h-svh bg-background text-foreground antialiased">
                <Script
                    id="dw-studio-theme"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{__html: themeInitScript()}}
                />
                <UmamiAnalytics />
                <ThemeProvider>
                    <LocaleProvider dictionary={dictionary} lang={lang}>
                        {children}
                    </LocaleProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
