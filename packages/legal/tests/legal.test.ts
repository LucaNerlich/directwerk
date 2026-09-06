import {describe, expect, it} from 'vitest'

import {IMPRINT, OPERATOR, PRIVACY} from '../src/index'

describe('legal content', () => {
    it('exposes an imprint page with provider, contact, and liability sections', () => {
        expect(IMPRINT.title).toBe('Impressum')
        expect(IMPRINT.sections.length).toBeGreaterThan(3)
        const headings = IMPRINT.sections.map((section) => section.heading)
        expect(headings).toContain('Diensteanbieter')
        expect(headings).toContain('Kontakt')
        expect(new Set(headings).size).toBe(headings.length)
        for (const section of IMPRINT.sections) {
            expect(section.paragraphs.length).toBeGreaterThan(0)
        }
    })

    it('exposes a privacy page covering controller, rights, and retention', () => {
        expect(PRIVACY.title).toBe('Datenschutzerklärung')
        const text = PRIVACY.sections
            .map((section) => `${section.heading}\n${section.paragraphs.join(' ')}`)
            .join('\n')
        for (const keyword of ['Verantwortlicher', 'Deine Rechte', 'Speicherdauer', 'Stripe']) {
            expect(text).toContain(keyword)
        }
    })

    it('renders operator details from the single OPERATOR source', () => {
        expect(OPERATOR.email).toContain('@')
        const imprintText = IMPRINT.sections.map((section) => section.paragraphs.join(' ')).join('\n')
        expect(imprintText).toContain(OPERATOR.name)
        expect(imprintText).toContain(OPERATOR.email)
        const privacyText = PRIVACY.sections.map((section) => section.paragraphs.join(' ')).join('\n')
        expect(privacyText).toContain(OPERATOR.name)
    })

    it('stamps ISO update dates', () => {
        for (const page of [IMPRINT, PRIVACY]) {
            expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
    })
})
