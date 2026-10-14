import {buildImprintSections, type ImprintStrings} from './imprint-strings'
import type {LegalPage} from './legal'

const STRINGS: ImprintStrings = {
    serviceProviderHeading: 'Service provider',
    serviceProvider: operator => `This platform (Directwerk) is represented by ${operator}.`,
    contactHeading: 'Contact',
    contactWithPhone: (email, phone) => `Email: ${email}, phone: ${phone}.`,
    contactEmailOnly: email => `Email: ${email}.`,
    registerHeading: 'Register entry',
    register: (court, number) => `Register court: ${court}, register number: ${number}.`,
    vatHeading: 'VAT ID',
    vat: vatId => `VAT identification number pursuant to § 27a UStG: ${vatId}.`,
    responsibleHeading: 'Responsible pursuant to § 18(2) MStV',
    odrHeading: 'EU dispute resolution',
    odr:
        'The European Commission has not provided an Online Dispute Resolution platform since ' +
        '20 July 2025. We are neither obliged nor willing to participate in a dispute resolution ' +
        'procedure before a consumer mediation entity.',
    liabilityHeading: 'Liability for content and links',
    liability:
        'The content of these pages was created with care; we assume no liability for accuracy, ' +
        'completeness, or timeliness. External links lead to content of third-party providers for ' +
        'which we bear no responsibility.',
}

/**
 * English imprint (§ 5 DDG). Faithful EN rendering of the German imprint, sharing the section
 * builder with it (issue #399).
 */
export const IMPRINT_EN: LegalPage = {
    title: 'Imprint',
    intro: 'Information pursuant to § 5 of the German Digital Services Act (DDG).',
    updated: '2026-10-03',
    sections: buildImprintSections(STRINGS),
}
