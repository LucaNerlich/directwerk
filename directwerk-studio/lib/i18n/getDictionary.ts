import 'server-only'

import {notFound} from 'next/navigation'

import type {Locale} from './config'
import {isLocale} from './config'
import type {Dictionary} from './dictionary'

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
    de: () => import('../../dictionaries/de.json').then((module) => module.default),
    en: () => import('../../dictionaries/en.json').then((module) => module.default),
}

export async function getDictionary(lang: string): Promise<Dictionary> {
    if (!isLocale(lang)) {
        notFound()
    }
    return dictionaries[lang]()
}

export function assertLocale(lang: string): Locale {
    if (!isLocale(lang)) {
        notFound()
    }
    return lang
}
