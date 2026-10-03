import {formatOperatorProviderLine, OPERATOR} from './operator'
import type {LegalPage, LegalSection} from './legal'

const ODR_URL = 'http://ec.europa.eu/consumers/odr/'

function buildImprintSections(): LegalSection[] {
    const sections: LegalSection[] = [
        {
            heading: 'Diensteanbieter',
            paragraphs: [
                `Diese Plattform (Directwerk) wird vertreten durch die Person ${formatOperatorProviderLine()}.`,
            ],
        },
        {
            heading: 'Kontakt',
            paragraphs: [
                OPERATOR.phone
                    ? `E-Mail: ${OPERATOR.email}, Telefon: ${OPERATOR.phone}.`
                    : `E-Mail: ${OPERATOR.email}.`,
            ],
        },
    ]

    if (OPERATOR.registerCourt && OPERATOR.registerNumber) {
        sections.push({
            heading: 'Registereintrag',
            paragraphs: [
                `Registergericht: ${OPERATOR.registerCourt}, Registernummer: ${OPERATOR.registerNumber}.`,
            ],
        })
    }

    if (OPERATOR.vatId) {
        sections.push({
            heading: 'Umsatzsteuer-ID',
            paragraphs: [
                `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${OPERATOR.vatId}.`,
            ],
        })
    }

    if (OPERATOR.responsiblePerson) {
        sections.push({
            heading: 'Verantwortlich i.S.d. § 18 Abs. 2 MStV',
            paragraphs: [OPERATOR.responsiblePerson],
        })
    }

    sections.push(
        {
            heading: 'EU-Streitbeilegung',
            paragraphs: [
                `Die EU-Kommission bietet die Möglichkeit zur Online-Streitbeilegung auf einer von ihr betriebenen Online-Plattform. Diese Plattform ist über den externen Link ${ODR_URL} zu erreichen. Zu einer Teilnahme an einem Schlichtungsverfahren sind wir nicht verpflichtet und können die Teilnahme an einem solchen Verfahren leider auch nicht anbieten.`,
            ],
        },
        {
            heading: 'Haftung für Inhalte und Links',
            paragraphs: [
                'Die Inhalte dieser Seiten wurden mit Sorgfalt erstellt; für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine Gewähr. Externe Links führen zu Inhalten fremder Anbieter, für die wir keine Verantwortung tragen.',
            ],
        },
    )

    return sections
}

/**
 * Shared Impressum (§ 5 DDG) rendered on all five surfaces. Operator details
 * come from {@link OPERATOR} — edit them there, not here.
 *
 * Content adapted from https://lucanerlich.com/imprint (TMG wording updated to
 * DDG; site-specific Umami tracking note left out — see privacy page).
 */
export const IMPRINT: LegalPage = {
    title: 'Impressum',
    intro: 'Nachstehende Informationen erteilen wir gemäß § 5 Digitale-Dienste-Gesetz (DDG).',
    updated: '2026-10-03',
    sections: buildImprintSections(),
}
