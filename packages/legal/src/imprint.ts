import {OPERATOR} from './operator'
import type {LegalPage} from './legal'

/**
 * Shared Impressum (§ 5 DDG) rendered on all five surfaces. Operator details
 * come from {@link OPERATOR} — edit them there, not here.
 */
export const IMPRINT: LegalPage = {
    title: 'Impressum',
    intro: 'Angaben gemäß § 5 DDG.',
    updated: '2026-09-06',
    sections: [
        {
            heading: 'Diensteanbieter',
            paragraphs: [
                `${OPERATOR.name}, ${OPERATOR.street}, ${OPERATOR.city}, ${OPERATOR.country}.`,
            ],
        },
        {
            heading: 'Kontakt',
            paragraphs: [
                `E-Mail: ${OPERATOR.email}, Telefon: ${OPERATOR.phone}.`,
            ],
        },
        {
            heading: 'Registereintrag',
            paragraphs: [
                `Registergericht: ${OPERATOR.registerCourt}, Registernummer: ${OPERATOR.registerNumber}.`,
            ],
        },
        {
            heading: 'Umsatzsteuer-ID',
            paragraphs: [
                `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${OPERATOR.vatId}.`,
            ],
        },
        {
            heading: 'Verantwortlich i.S.d. § 18 Abs. 2 MStV',
            paragraphs: [OPERATOR.responsiblePerson],
        },
        {
            heading: 'EU-Streitbeilegung',
            paragraphs: [
                'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
            ],
        },
        {
            heading: 'Haftung für Inhalte und Links',
            paragraphs: [
                'Die Inhalte dieser Seiten wurden mit Sorgfalt erstellt; für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine Gewähr. Externe Links führen zu Inhalten fremder Anbieter, für die wir keine Verantwortung tragen.',
            ],
        },
    ],
}
