'use client'

import {createContext, useContext} from 'react'

import type {Locale} from '@/lib/i18n/config'
import type {Dictionary} from '@/lib/i18n/get-dictionary'
import {localeCookieName} from '@/lib/i18n/config'

type LocaleContextValue = {
    lang: Locale
    dictionary: Dictionary
    setLocalePreference: (lang: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
    lang,
    dictionary,
    children,
}: {
    lang: Locale
    dictionary: Dictionary
    children: React.ReactNode
}): React.JSX.Element {
    function setLocalePreference(next: Locale): void {
        document.cookie = `${localeCookieName}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    }

    return (
        <LocaleContext.Provider value={{lang, dictionary, setLocalePreference}}>
            {children}
        </LocaleContext.Provider>
    )
}

export function useLocale(): LocaleContextValue {
    const value = useContext(LocaleContext)
    if (!value) {
        throw new Error('useLocale must be used within LocaleProvider')
    }
    return value
}

export function useDictionary(): Dictionary {
    return useLocale().dictionary
}
