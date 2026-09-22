import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import LogoutButton from '@/components/studio/LogoutButton'

const {push, clearTokens, clearAllCachedTenantData} = vi.hoisted(() => ({
    push: vi.fn(),
    clearTokens: vi.fn(),
    clearAllCachedTenantData: vi.fn(),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({push})}))
vi.mock('@/lib/auth/MeProvider', () => ({useOptionalMe: () => null}))
vi.mock('@/lib/auth/tokenStore', () => ({clearTokens}))
vi.mock('@directwerk/api/client/useCachedTenantQuery', () => ({clearAllCachedTenantData}))

describe('LogoutButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('clears local auth state and redirects only after a successful logout', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, {status: 204}))

        render(<LogoutButton />)
        fireEvent.click(screen.getByRole('button', {name: 'Abmelden'}))

        await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
        expect(clearTokens).toHaveBeenCalledOnce()
        expect(clearAllCachedTenantData).toHaveBeenCalledOnce()
    })

    it.each([
        ['a non-OK response', () => Promise.resolve(new Response(null, {status: 503}))],
        ['a transport error', () => Promise.reject(new TypeError('network down'))],
    ])('preserves local auth state after %s', async (_label, response) => {
        vi.mocked(fetch).mockImplementation(response)

        render(<LogoutButton />)
        fireEvent.click(screen.getByRole('button', {name: 'Abmelden'}))

        expect(await screen.findByRole('alert')).toHaveTextContent('Abmeldung fehlgeschlagen')
        expect(clearTokens).not.toHaveBeenCalled()
        expect(clearAllCachedTenantData).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })
})
