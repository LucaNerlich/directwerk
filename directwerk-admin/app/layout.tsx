import type {Metadata} from 'next'
import {connection} from 'next/server'

import AuthBootstrap from '@/components/AuthBootstrap'
import Header from '@/components/Header'
import UmamiAnalytics from '@directwerk/ui/components/umami-analytics'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk platform admin',
    description: 'Directwerk platform administration',
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    // CSP nonces from proxy.ts are applied during SSR only — not on prerendered HTML.
    await connection()

    return (
        <html lang="en">
            <body>
                <UmamiAnalytics />
                <AuthBootstrap>
                    <Header>{children}</Header>
                </AuthBootstrap>
            </body>
        </html>
    )
}
