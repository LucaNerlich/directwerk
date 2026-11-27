import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {describe, expect, it, vi} from 'vitest'

const createApiKey = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/apiKeysApi', () => ({
    listApiKeys: vi.fn().mockResolvedValue([]),
    createApiKey: (...args: unknown[]) => createApiKey(...args),
    revokeApiKey: vi.fn(),
}))

import ApiKeysClient from './ApiKeysClient'

describe('ApiKeysClient one-time secret', () => {
    it('keeps the secret dialog open on Escape until the user is done', async () => {
        createApiKey.mockResolvedValue({
            id: 1,
            name: 'Cursor',
            secret: 'dwk_secret_123',
            prefix: 'dwk_',
            scopes: ['content:read'],
            createdAt: '2026-01-01T00:00:00Z',
        })
        renderWithLocale(<ApiKeysClient mcpUrl="https://api.example.test/mcp" />)

        fireEvent.click(
            await screen.findByRole('button', {name: 'API-Schlüssel erstellen'}),
        )
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name'), {
            target: {value: 'Cursor'},
        })
        fireEvent.click(within(dialog).getByLabelText(/content:read/))
        fireEvent.click(
            within(dialog).getByRole('button', {name: 'API-Schlüssel erstellen'}),
        )

        expect(await screen.findByDisplayValue('dwk_secret_123')).toBeInTheDocument()
        fireEvent.keyDown(document, {key: 'Escape'})

        await waitFor(() =>
            expect(screen.getByDisplayValue('dwk_secret_123')).toBeInTheDocument(),
        )
        expect(screen.getByRole('button', {name: 'Fertig'})).toBeInTheDocument()
    })
})
