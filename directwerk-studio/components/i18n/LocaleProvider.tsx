'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {Dictionary} from '@/lib/i18n/dictionary'
import type {Locale} from '@/lib/i18n/config'

interface LocaleContextValue {
    lang: Locale
    dictionary: Dictionary
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
    lang,
    dictionary,
    children,
}: {
    lang: Locale
    dictionary: Dictionary
    children: ReactNode
}) {
    return (
        <LocaleContext.Provider value={{lang, dictionary}}>{children}</LocaleContext.Provider>
    )
}

export function useLocale(): Locale {
    const ctx = useContext(LocaleContext)
    if (ctx === null) {
        throw new Error('useLocale must be used within LocaleProvider')
    }
    return ctx.lang
}

export function useDictionary(): Dictionary {
    const ctx = useContext(LocaleContext)
    if (ctx === null) {
        throw new Error('useDictionary must be used within LocaleProvider')
    }
    return ctx.dictionary
}

export function useOptionalDictionary(): Dictionary | null {
    return useContext(LocaleContext)?.dictionary ?? null
}
