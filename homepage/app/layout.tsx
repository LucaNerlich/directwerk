import type {Metadata} from 'next'
import {Geist, Geist_Mono} from 'next/font/google'

import MarketingShell from '@/components/marketing/MarketingShell'

import './globals.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: {
        default: 'Directwerk',
        template: '%s · Directwerk',
    },
    description:
        'API-first Whitelabel-Plattform für Podcast, Abonnements und digitales Publishing.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>): React.JSX.Element {
    return (
        <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`}>
            <body className="min-h-screen antialiased">
                <MarketingShell>{children}</MarketingShell>
            </body>
        </html>
    )
}
