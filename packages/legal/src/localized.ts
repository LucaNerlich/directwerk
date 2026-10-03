import type {LegalPage} from './legal'
import {IMPRINT} from './imprint'
import {IMPRINT_EN} from './imprint-en'
import {PRIVACY} from './privacy'

export type LegalLocale = 'de' | 'en'

/** German privacy is canonical until a dedicated EN privacy pass lands. */
export function getPrivacy(locale: LegalLocale = 'de'): LegalPage {
    void locale
    return PRIVACY
}

export function getImprint(locale: LegalLocale = 'de'): LegalPage {
    return locale === 'en' ? IMPRINT_EN : IMPRINT
}
