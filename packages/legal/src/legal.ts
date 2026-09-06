/**
 * Shared legal content (one top-level package for #187).
 *
 * A single legal section: a heading plus plain-text paragraphs. Plain strings keep
 * every surface (Next.js apps, VitePress docs) able to render the same content
 * with its own components.
 */
export interface LegalSection {
    heading: string
    paragraphs: string[]
}

export interface LegalPage {
    /** Page title, e.g. shown as the H1. */
    title: string
    /** Short lede under the title. */
    intro: string
    /** Last substantive update, ISO date — shown at the bottom of the page. */
    updated: string
    sections: LegalSection[]
}
