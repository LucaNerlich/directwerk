import {describe, expect, it} from 'vitest'

import {looksLikeTipTapHtml, renderContentHtml} from '../src/content/renderContentHtml'

describe('renderContentHtml', () => {
    it('detects TipTap-shaped HTML bodies', () => {
        expect(looksLikeTipTapHtml('<p>Hello</p>')).toBe(true)
        expect(looksLikeTipTapHtml('# Heading\n\n**bold**')).toBe(false)
        expect(
            looksLikeTipTapHtml('# Title\n\nSee <a href="https://x.test">x</a> for **y**.'),
        ).toBe(false)
    })

    it('passes through sanitized HTML from TipTap', () => {
        const html =
            '<h2>Intro</h2><p>Hello <strong>friend</strong>.</p><ul><li>One</li></ul>'
        const rendered = renderContentHtml(html)
        expect(rendered).toContain('<h2>Intro</h2>')
        expect(rendered).toContain('<strong>friend</strong>')
        expect(rendered).toContain('<li>One</li>')
    })

    it('renders CommonMark to HTML', () => {
        const md = [
            '# WoW Classic Leveling Guide',
            '',
            'A walkthrough from levels **1–60**.',
            '',
            '> Level ranges are community guidance.',
            '',
            '## How to use this guide',
            '',
            '1. Pick your faction',
            '2. Open each zone article',
            '',
            'See [overview](/en/a/forever-wow-forever-overview).',
        ].join('\n')

        const rendered = renderContentHtml(md)
        expect(rendered).toContain('<h2>WoW Classic Leveling Guide</h2>')
        expect(rendered).toContain('<strong>1–60</strong>')
        expect(rendered).toContain('<blockquote>')
        expect(rendered).toContain('<h2>How to use this guide</h2>')
        expect(rendered).toContain('<ol>')
        expect(rendered).toContain('href="/en/a/forever-wow-forever-overview"')
        expect(rendered).not.toContain('# WoW')
        expect(rendered).not.toContain('**1–60**')
    })

    it('decodes OWASP-escaped Markdown before rendering', () => {
        const escaped =
            '# Alliance &amp; Horde\n\n&gt; Move on when quests turn green.\n\n' +
            'Blizzard&#39;s Forever launch.'

        const rendered = renderContentHtml(escaped)
        expect(rendered).toContain('<h2>Alliance &amp; Horde</h2>')
        expect(rendered).toContain('<blockquote>')
        expect(rendered).toContain("Blizzard's Forever launch.")
        expect(rendered).not.toContain('&gt;')
        expect(rendered).not.toContain('&#39;')
    })

    it('strips unsafe markup from Markdown HTML passthrough', () => {
        const rendered = renderContentHtml('Hello <script>alert(1)</script> **there**')
        expect(rendered).toContain('<strong>there</strong>')
        expect(rendered).not.toContain('<script>')
        expect(rendered).not.toContain('alert')
    })

    it('converts Markdown that embeds inline HTML', () => {
        const rendered = renderContentHtml(
            '# Title\n\nSee <a href="https://x.test">x</a> for **y**.',
        )
        expect(rendered).toContain('<h2>Title</h2>')
        expect(rendered).toContain('<strong>y</strong>')
        expect(rendered).toContain('href="https://x.test"')
        expect(rendered).not.toContain('# Title')
        expect(rendered).not.toContain('**y**')
    })

    it('does not throw on invalid numeric entities', () => {
        const rendered = renderContentHtml('# ok\n\n&#x110000;\n\n&#999999999;')
        expect(rendered).toContain('<h2>ok</h2>')
        expect(rendered).not.toContain('# ok')
    })
})
