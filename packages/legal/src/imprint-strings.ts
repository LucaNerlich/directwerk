import type {LegalSection} from './legal'
import {formatOperatorProviderLine, OPERATOR} from './operator'

/**
 * Issue #399: the German and English imprints were structurally identical builders that differed
 * only in literal strings, so every conditional-section edit had to be made twice. The shared
 * builder below owns the structure; each locale supplies its own strings.
 */
export interface ImprintStrings {
    serviceProviderHeading: string
    serviceProvider: (operator: string) => string
    contactHeading: string
    contactWithPhone: (email: string, phone: string) => string
    contactEmailOnly: (email: string) => string
    registerHeading: string
    register: (court: string, number: string) => string
    vatHeading: string
    vat: (vatId: string) => string
    responsibleHeading: string
    odrHeading: string
    odr: string
    liabilityHeading: string
    liability: string
}

/** Builds the conditional § 5 DDG section list shared by both imprints. */
export function buildImprintSections(strings: ImprintStrings): LegalSection[] {
    const sections: LegalSection[] = [
        {heading: strings.serviceProviderHeading, paragraphs: [strings.serviceProvider(formatOperatorProviderLine())]},
        {
            heading: strings.contactHeading,
            paragraphs: [
                OPERATOR.phone
                    ? strings.contactWithPhone(OPERATOR.email, OPERATOR.phone)
                    : strings.contactEmailOnly(OPERATOR.email),
            ],
        },
    ]

    if (OPERATOR.registerCourt && OPERATOR.registerNumber) {
        sections.push({
            heading: strings.registerHeading,
            paragraphs: [strings.register(OPERATOR.registerCourt, OPERATOR.registerNumber)],
        })
    }

    if (OPERATOR.vatId) {
        sections.push({
            heading: strings.vatHeading,
            paragraphs: [strings.vat(OPERATOR.vatId)],
        })
    }

    if (OPERATOR.responsiblePerson) {
        sections.push({
            heading: strings.responsibleHeading,
            paragraphs: [OPERATOR.responsiblePerson],
        })
    }

    sections.push(
        {heading: strings.odrHeading, paragraphs: [strings.odr]},
        {heading: strings.liabilityHeading, paragraphs: [strings.liability]},
    )

    return sections
}
