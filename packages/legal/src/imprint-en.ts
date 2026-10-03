import {formatOperatorProviderLine, OPERATOR} from './operator'
import type {LegalPage, LegalSection} from './legal'

const ODR_URL = 'http://ec.europa.eu/consumers/odr/'

function buildImprintSectionsEn(): LegalSection[] {
    const sections: LegalSection[] = [
        {
            heading: 'Service provider',
            paragraphs: [
                `This platform (Directwerk) is represented by ${formatOperatorProviderLine()}.`,
            ],
        },
        {
            heading: 'Contact',
            paragraphs: [
                OPERATOR.phone
                    ? `Email: ${OPERATOR.email}, phone: ${OPERATOR.phone}.`
                    : `Email: ${OPERATOR.email}.`,
            ],
        },
    ]

    if (OPERATOR.registerCourt && OPERATOR.registerNumber) {
        sections.push({
            heading: 'Register entry',
            paragraphs: [
                `Register court: ${OPERATOR.registerCourt}, register number: ${OPERATOR.registerNumber}.`,
            ],
        })
    }

    if (OPERATOR.vatId) {
        sections.push({
            heading: 'VAT ID',
            paragraphs: [
                `VAT identification number pursuant to § 27a UStG: ${OPERATOR.vatId}.`,
            ],
        })
    }

    if (OPERATOR.responsiblePerson) {
        sections.push({
            heading: 'Responsible pursuant to § 18(2) MStV',
            paragraphs: [OPERATOR.responsiblePerson],
        })
    }

    sections.push(
        {
            heading: 'EU dispute resolution',
            paragraphs: [
                `The European Commission offers an Online Dispute Resolution (ODR) platform at ${ODR_URL}. We are neither obliged nor willing to participate in a dispute resolution procedure before a consumer mediation entity.`,
            ],
        },
        {
            heading: 'Liability for content and links',
            paragraphs: [
                'The content of these pages was created with care; we assume no liability for accuracy, completeness, or timeliness. External links lead to content of third-party providers for which we bear no responsibility.',
            ],
        },
    )

    return sections
}

/**
 * English imprint (§ 5 DDG). Faithful EN rendering of the German imprint;
 * ODR paragraph follows the bilingual wording on lucanerlich.com/imprint.
 */
export const IMPRINT_EN: LegalPage = {
    title: 'Imprint',
    intro: 'Information pursuant to § 5 of the German Digital Services Act (DDG).',
    updated: '2026-10-03',
    sections: buildImprintSectionsEn(),
}
