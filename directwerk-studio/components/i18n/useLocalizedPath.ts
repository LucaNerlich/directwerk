'use client'

import {useCallback} from 'react'
import {usePathname} from 'next/navigation'

import {defaultLocale, type Locale} from '@/lib/i18n/config'
import {localeFromPathname, localizedPath, swapLangInPath} from '@/lib/i18n/paths'

import {useLocale} from './LocaleProvider'

export function useLocalizedPath(): (path: string) => string {
    const lang = useLocale()
    return useCallback((path: string) => localizedPath(lang, path), [lang])
}

/** Locale from provider, or pathname fallback for edge cases outside the provider. */
export function useLangFromPath(): Locale {
    const pathname = usePathname()
    return localeFromPathname(pathname) ?? defaultLocale
}

export function useSwapLangPath(): (nextLang: Locale) => string {
    const pathname = usePathname()
    return useCallback((nextLang: Locale) => swapLangInPath(pathname, nextLang), [pathname])
}
