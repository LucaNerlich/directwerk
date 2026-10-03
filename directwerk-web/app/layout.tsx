import type {ReactNode} from 'react'

import './globals.css'

/**
 * Root shell only. Tenant chrome, auth, and dictionaries live under
 * `app/[lang]/layout.tsx`. Route handlers (`/api/**`, `/feeds/**`) share this
 * minimal document wrapper without locale UI.
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode
}>): React.JSX.Element {
    return (
        <html lang="de" suppressHydrationWarning>
            <body>{children}</body>
        </html>
    )
}
