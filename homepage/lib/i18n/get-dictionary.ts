import type {Locale} from '@/lib/i18n/config'

import type de from '../../dictionaries/de.json'

export type Dictionary = typeof de

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
    de: () => import('../../dictionaries/de.json').then((module) => module.default),
    en: () => import('../../dictionaries/en.json').then((module) => module.default),
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
    return dictionaries[locale]()
}
