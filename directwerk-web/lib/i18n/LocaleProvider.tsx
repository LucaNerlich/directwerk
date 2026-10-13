'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {Dictionary} from './dictionary'
import type {Locale} from './config'

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
}): React.JSX.Element {
    return (
        <LocaleContext.Provider value={{lang, dictionary}}>
            {children}
        </LocaleContext.Provider>
    )
}

export function useLocale(): Locale {
    return useLocaleContext().lang
}

export function useDictionary(): Dictionary {
    return useLocaleContext().dictionary
}

function useLocaleContext(): LocaleContextValue {
    const value = useContext(LocaleContext)
    if (value === null) {
        throw new Error('useLocale/useDictionary must be used within LocaleProvider')
    }
    return value
}
