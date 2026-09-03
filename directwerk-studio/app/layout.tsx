import type {Metadata} from 'next'

import UmamiAnalytics from '@/components/UmamiAnalytics'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk Studio',
    description: 'Creator dashboard for Directwerk publishers',
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
    return (
        <html lang="de">
            <body className="min-h-svh bg-background text-foreground antialiased">
                <UmamiAnalytics />
                {children}
            </body>
        </html>
    )
}
