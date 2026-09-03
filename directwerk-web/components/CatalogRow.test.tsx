import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogRow, {LockedCatalogAction} from '@/components/CatalogRow'

afterEach(cleanup)

describe('CatalogRow', () => {
    it('unifies badge placement, meta order and CTA', () => {
        const {container} = render(
            <ul>
                <CatalogRow
                    href="/articles/mein-beitrag"
                    title="Mein Beitrag"
                    badge={<AccessPolicyBadge policy="PAID" />}
                    metaItems={['Kategorie A', '01.01.2026']}
                    excerpt="Kurzer Teaser."
                    action={<LockedCatalogAction isAuthenticated unlockHref="/pricing#basis" />}
                />
            </ul>
        )

        expect(
            screen.getByRole('link', {name: 'Mein Beitrag'}),
        ).toHaveAttribute('href', '/articles/mein-beitrag')
        expect(screen.getByText('Mitgliedschaft nötig')).toBeInTheDocument()
        expect(container.textContent).toContain('Kategorie A · 01.01.2026')
        expect(screen.getByText('Kurzer Teaser.')).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Freischalten'}),
        ).toHaveAttribute('href', '/pricing#basis')
    })

    it('sends guests to login for locked rows', () => {
        render(
            <ul>
                <CatalogRow
                    href="/episodes/folge-1"
                    title="Folge 1"
                    badge={<AccessPolicyBadge policy="PAID" />}
                    metaItems={['serie', '02.01.2026', '10:00']}
                    action={
                        <LockedCatalogAction isAuthenticated={false} unlockHref="/pricing" />
                    }
                />
            </ul>
        )

        expect(screen.getByRole('button', {name: 'Anmelden'})).toHaveAttribute(
            'href',
            '/login',
        )
    })

    it('marks entitled paid items as enthalten', () => {
        render(<AccessPolicyBadge policy="PAID" isEntitled />)
        expect(screen.getByText('Enthalten')).toBeInTheDocument()
    })
})
