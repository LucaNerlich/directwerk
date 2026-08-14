import type {Metadata} from 'next'

import './globals.css'

export const metadata: Metadata = {
    title: 'Directwerk Studio',
    description: 'Creator dashboard for Directwerk publishers',
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
    return (
        <html lang="de">
            <body>{children}</body>
        </html>
    )
}
