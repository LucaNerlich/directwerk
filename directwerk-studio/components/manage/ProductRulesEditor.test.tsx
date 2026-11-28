import {fireEvent, screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {describe, expect, it, vi} from 'vitest'

const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))

const listProductRules = vi.fn()
const replaceProductRules = vi.fn()
vi.mock('@/lib/api/subscriptionApi', () => ({
    listProductRules: (...args: unknown[]) => listProductRules(...args),
    replaceProductRules: (...args: unknown[]) => replaceProductRules(...args),
}))
vi.mock('@/lib/api/catalogApi', () => ({
    listCategories: vi.fn().mockResolvedValue([]),
    listFormats: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/api/podcastApi', () => ({listSeries: vi.fn().mockResolvedValue([])}))
vi.mock('@/lib/api/listAllMedia', () => ({listAllMedia: vi.fn().mockResolvedValue([])}))

import ProductRulesEditor from './ProductRulesEditor'

describe('ProductRulesEditor load guard', () => {
    it('keeps saving disabled when the rules load fails', async () => {
        listProductRules.mockRejectedValueOnce(new Error('Regeln nicht erreichbar'))
        renderWithLocale(<ProductRulesEditor productId={5} />)

        expect(await screen.findByRole('alert')).toHaveTextContent('Regeln nicht erreichbar')
        expect(screen.getByRole('button', {name: 'Regeln speichern'})).toBeDisabled()
        expect(replaceProductRules).not.toHaveBeenCalled()
    })

    it('clears the load error when a retry succeeds', async () => {
        listProductRules
            .mockRejectedValueOnce(new Error('Regeln nicht erreichbar'))
            .mockResolvedValueOnce([])
        renderWithLocale(<ProductRulesEditor productId={5} />)

        expect(await screen.findByRole('alert')).toHaveTextContent('Regeln nicht erreichbar')
        fireEvent.click(screen.getByRole('button', {name: 'Erneut versuchen'}))

        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    })
})
