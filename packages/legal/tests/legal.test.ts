import {describe, expect, it} from 'vitest'

import {
    IMPRINT,
    IMPRINT_EN,
    OPERATOR,
    PRIVACY,
    getImprint,
    getPrivacy,
} from '../src/index'

describe('legal content', () => {
    it('exposes an imprint page with provider, contact, and liability sections', () => {
        expect(IMPRINT.title).toBe('Impressum')
        expect(IMPRINT.sections.length).toBeGreaterThan(3)
        const headings = IMPRINT.sections.map((section) => section.heading)
        expect(headings).toContain('Diensteanbieter')
        expect(headings).toContain('Kontakt')
        expect(headings).toContain('EU-Streitbeilegung')
        expect(new Set(headings).size).toBe(headings.length)
        for (const section of IMPRINT.sections) {
            expect(section.paragraphs.length).toBeGreaterThan(0)
        }
    })

    it('omits register and VAT sections while those operator fields are unset', () => {
        const headings = IMPRINT.sections.map((section) => section.heading)
        expect(headings).not.toContain('Registereintrag')
        expect(headings).not.toContain('Umsatzsteuer-ID')
        expect(OPERATOR.registerCourt).toBeNull()
        expect(OPERATOR.vatId).toBeNull()
    })

    it('exposes a privacy page covering controller, rights, and retention', () => {
        expect(PRIVACY.title).toBe('Datenschutzerklärung')
        const text = PRIVACY.sections
            .map((section) => `${section.heading}\n${section.paragraphs.join(' ')}`)
            .join('\n')
        for (const keyword of ['Verantwortlicher', 'Deine Rechte', 'Speicherdauer', 'Stripe']) {
            expect(text).toContain(keyword)
        }
        expect(text).not.toContain('MUSTER')
        expect(text).not.toContain('Musterstraße')
    })

    it('exposes English imprint via getImprint', () => {
        expect(getImprint('en').title).toBe('Imprint')
        expect(getImprint('de')).toBe(IMPRINT)
        expect(getPrivacy('de')).toBe(PRIVACY)
        expect(IMPRINT_EN.sections.some((section) => section.heading === 'Service provider')).toBe(
            true,
        )
        expect(
            getImprint('en')
                .sections.map((section) => section.paragraphs.join(' '))
                .join('\n'),
        ).toContain(OPERATOR.name)
    })

    it('renders real operator details from lucanerlich.com (no MUSTER placeholders)', () => {
        expect(OPERATOR.name).toBe('Luca Nerlich')
        expect(OPERATOR.email).toBe('luca.nerlich@gmail.com')
        expect(OPERATOR.email).toContain('@')
        const imprintText = IMPRINT.sections.map((section) => section.paragraphs.join(' ')).join('\n')
        expect(imprintText).toContain(OPERATOR.name)
        expect(imprintText).toContain(OPERATOR.email)
        expect(imprintText).not.toContain('MUSTER')
        expect(imprintText).toContain('ec.europa.eu/consumers/odr')
        const privacyText = PRIVACY.sections.map((section) => section.paragraphs.join(' ')).join('\n')
        expect(privacyText).toContain(OPERATOR.name)
        expect(privacyText).toContain(OPERATOR.email)
    })

    it('stamps ISO update dates', () => {
        for (const page of [IMPRINT, PRIVACY, IMPRINT_EN]) {
            expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
    })
})
