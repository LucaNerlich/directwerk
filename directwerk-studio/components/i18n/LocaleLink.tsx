'use client'

import Link from 'next/link'
import type {ComponentProps} from 'react'

import {localizedPath} from '@/lib/i18n/paths'

import {useLocale} from './LocaleProvider'

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    href: string
}

/**
 * Next.js `Link` that prefixes the active locale onto logical app paths.
 * External URLs and already-prefixed paths are left unchanged by {@link localizedPath}.
 */
export default function LocaleLink({href, ...props}: LocaleLinkProps) {
    const lang = useLocale()
    return <Link href={localizedPath(lang, href)} {...props} />
}
