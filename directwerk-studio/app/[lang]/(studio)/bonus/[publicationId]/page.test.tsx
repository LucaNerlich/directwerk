import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import BonusPublicationPage from '@/app/(studio)/bonus/[publicationId]/page'

vi.mock('@/components/media/DigitalPublicationEditor', () => ({
    default: ({publicationId}: {publicationId: number}) => (
        <p data-testid="publication-id">{publicationId}</p>
    ),
}))

describe('BonusPublicationPage', () => {
    it.each(['0', '01', '001', '-1', 'abc'])('rejects non-canonical publication id %s', async (publicationId) => {
        render(await BonusPublicationPage({params: Promise.resolve({publicationId})}))

        expect(screen.getByText('Ungültige Bonusdatei.')).toBeInTheDocument()
    })

    it('accepts a canonical positive decimal publication id', async () => {
        render(await BonusPublicationPage({params: Promise.resolve({publicationId: '123'})}))

        expect(screen.getByTestId('publication-id')).toHaveTextContent('123')
    })
})
