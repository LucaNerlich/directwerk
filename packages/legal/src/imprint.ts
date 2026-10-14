import {buildImprintSections, type ImprintStrings} from './imprint-strings'
import type {LegalPage} from './legal'

/**
 * Issue #404: the ODR paragraph no longer links to the EU ODR platform — it ceased operation on
 * 20 July 2025 (Reg. (EU) 2024/3228 repealed the ODR regulation), so the old `http://` link
 * pointed at a dead, insecure URL from an HTTPS site.
 */
const STRINGS: ImprintStrings = {
    serviceProviderHeading: 'Diensteanbieter',
    serviceProvider: operator =>
        `Diese Plattform (Directwerk) wird vertreten durch die Person ${operator}.`,
    contactHeading: 'Kontakt',
    contactWithPhone: (email, phone) => `E-Mail: ${email}, Telefon: ${phone}.`,
    contactEmailOnly: email => `E-Mail: ${email}.`,
    registerHeading: 'Registereintrag',
    register: (court, number) => `Registergericht: ${court}, Registernummer: ${number}.`,
    vatHeading: 'Umsatzsteuer-ID',
    vat: vatId => `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${vatId}.`,
    responsibleHeading: 'Verantwortlich i.S.d. § 18 Abs. 2 MStV',
    odrHeading: 'EU-Streitbeilegung',
    odr:
        'Die EU-Kommission stellt seit dem 20. Juli 2025 keine Online-Streitbeilegungsplattform mehr bereit. ' +
        'Zu einer Teilnahme an einem Schlichtungsverfahren sind wir nicht verpflichtet und können die Teilnahme ' +
        'an einem solchen Verfahren leider auch nicht anbieten.',
    liabilityHeading: 'Haftung für Inhalte und Links',
    liability:
        'Die Inhalte dieser Seiten wurden mit Sorgfalt erstellt; für Richtigkeit, Vollständigkeit und Aktualität ' +
        'übernehmen wir keine Gewähr. Externe Links führen zu Inhalten fremder Anbieter, für die wir keine ' +
        'Verantwortung tragen.',
}

/**
 * Shared Impressum (§ 5 DDG) rendered on all five surfaces. Operator details
 * come from `OPERATOR` — edit them there, not here.
 *
 * Content adapted from https://lucanerlich.com/imprint (TMG wording updated to
 * DDG; site-specific Umami tracking note left out — see privacy page).
 */
export const IMPRINT: LegalPage = {
    title: 'Impressum',
    intro: 'Nachstehende Informationen erteilen wir gemäß § 5 Digitale-Dienste-Gesetz (DDG).',
    updated: '2026-10-03',
    sections: buildImprintSections(STRINGS),
}
