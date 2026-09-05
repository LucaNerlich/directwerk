import type {Metadata} from 'next'
import {connection} from 'next/server'

import UmamiAnalytics from '@directwerk/ui/components/umami-analytics'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk Studio',
    description: 'Creator dashboard for Directwerk publishers',
}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
    await connection()

    return (
        <html lang="de">
            <body className="min-h-svh bg-background text-foreground antialiased">
                <UmamiAnalytics />
                {children}
            </body>
        </html>
    )
}
