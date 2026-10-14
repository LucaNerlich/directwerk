import type {LegalPage} from './legal'
import {IMPRINT} from './imprint'
import {IMPRINT_EN} from './imprint-en'
import {PRIVACY} from './privacy'

export type LegalLocale = 'de' | 'en'

/**
 * Issue #401: the previous `locale` parameter was accepted and silently ignored (`void locale`),
 * advertising a capability that does not exist — an EN visitor got the German
 * Datenschutzerklärung with no signal. German is canonical until a dedicated EN privacy pass
 * lands; there is deliberately no parameter until then.
 */
export function getPrivacy(): LegalPage {
    return PRIVACY
}

export function getImprint(locale: LegalLocale = 'de'): LegalPage {
    return locale === 'en' ? IMPRINT_EN : IMPRINT
}
