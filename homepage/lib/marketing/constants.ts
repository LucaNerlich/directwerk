export const CONTACT_EMAIL = 'hello@directwerk.org'

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8080'

export const DOCS_URL =
    process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.directwerk.org'

export const NAV_ITEMS = [
    {href: '/#features', label: 'Plattform'},
    {href: '/#datenschutz', label: 'Datenschutz'},
    {href: '/#feeds', label: 'Feeds'},
    {href: '/#products', label: 'Produkte'},
    {href: '/developers', label: 'Entwickler'},
    {href: '/#contact', label: 'Kontakt'},
    {href: DOCS_URL, label: 'Dokumentation', external: true},
] as const
