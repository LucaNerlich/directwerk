import 'server-only'

import type {Locale} from './config'
import type {Dictionary} from './dictionary'

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
    de: () => import('../../dictionaries/de.json').then((mod) => mod.default),
    en: () => import('../../dictionaries/en.json').then((mod) => mod.default),
}

export async function getDictionary(lang: Locale): Promise<Dictionary> {
    return dictionaries[lang]()
}
