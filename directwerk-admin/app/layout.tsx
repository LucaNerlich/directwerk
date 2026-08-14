import type {Metadata} from 'next'

import AuthBootstrap from '@/components/AuthBootstrap'
import Header from '@/components/Header'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk platform admin',
    description: 'Directwerk platform administration',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body>
                <AuthBootstrap>
                    <Header>{children}</Header>
                </AuthBootstrap>
            </body>
        </html>
    )
}
