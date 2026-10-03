import type {ReactNode} from 'react'

import './globals.css'

/**
 * Pass-through root layout. The real `<html>` / `<body>` live in
 * `app/[lang]/layout.tsx` so `lang` can follow the path segment.
 */
export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
    return children
}
