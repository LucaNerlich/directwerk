import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {Geist, Geist_Mono} from 'next/font/google'

import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import MarketingShell from '@/components/marketing/MarketingShell'
import {isLocale, locales, type Locale} from '@/lib/i18n/config'
import {hrefFor, localeAlternates} from '@/lib/i18n/pathname'
import {getDictionary} from '@/lib/i18n/get-dictionary'
import UmamiAnalytics from '@directwerk/ui/components/umami-analytics'

import '../globals.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export async function generateStaticParams(): Promise<Array<{lang: Locale}>> {
    return locales.map((lang) => ({lang}))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        return {}
    }
    const dict = await getDictionary(rawLang)
    return {
        // Issue #348: without metadataBase Next emits the hreflang links as relative
        // ('/de', '/en') so crawlers discard them, and pages carried no canonical at all.
        metadataBase: new URL('https://directwerk.org'),
        title: {
            default: dict.meta.siteTitle,
            template: dict.meta.siteTitleTemplate,
        },
        description: dict.meta.siteDescription,
        alternates: {
            canonical: hrefFor(rawLang, '/'),
            languages: localeAlternates('/'),
        },
    }
}

export default async function LangLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode
    params: Promise<{lang: string}>
}>): Promise<React.JSX.Element> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        notFound()
    }
    const dictionary = await getDictionary(rawLang)

    return (
        <html lang={rawLang} className={`${geistSans.variable} ${geistMono.variable}`}>
            <body className="min-h-screen antialiased">
                <UmamiAnalytics maskLevel={process.env.NEXT_PUBLIC_UMAMI_MASK_LEVEL ?? 'moderate'} />
                <LocaleProvider dictionary={dictionary} lang={rawLang}>
                    <MarketingShell>{children}</MarketingShell>
                </LocaleProvider>
            </body>
        </html>
    )
}
