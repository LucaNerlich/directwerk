import {resolveApiBaseUrl} from './apiUrl'

export const CONTACT_EMAIL = 'hello@directwerk.org'

export const API_URL = resolveApiBaseUrl()

export const DOCS_URL =
    process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.directwerk.org'

/** Live tenant site used as the public working example on the marketing homepage. */
export const LIVE_EXAMPLE_NAME = 'Liedermacherleben'
export const LIVE_EXAMPLE_URL = 'https://liedermacherleben.directwerk.org'

export const NAV_ITEMS = [
    {href: '/#features', label: 'Plattform'},
    {href: '/privacy', label: 'Datenschutz'},
    {href: '/#beispiel', label: 'Beispiel'},
    {href: '/#feeds', label: 'Feeds'},
    {href: '/#products', label: 'Produkte'},
    {href: '/developers', label: 'Entwickler'},
    {href: '/#contact', label: 'Kontakt'},
    {href: '/imprint', label: 'Impressum'},
    {href: DOCS_URL, label: 'Dokumentation', external: true},
] as const
