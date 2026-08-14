import type {Metadata} from 'next'

import AuthBootstrap from '@/components/AuthBootstrap'
import Header from '@/components/Header'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk subscriber demo',
    description: 'Minimal two-tenant Directwerk subscriber frontend',
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
