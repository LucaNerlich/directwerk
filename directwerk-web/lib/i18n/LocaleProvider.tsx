'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {Dictionary} from './dictionary'
import type {Locale} from './config'
import {interpolate} from './interpolate'

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

export function useT(): (
    template: string,
    vars?: Record<string, string | number>,
) => string {
    return interpolate
}

function useLocaleContext(): LocaleContextValue {
    const value = useContext(LocaleContext)
    if (value === null) {
        throw new Error('useLocale/useDictionary must be used within LocaleProvider')
    }
    return value
}
