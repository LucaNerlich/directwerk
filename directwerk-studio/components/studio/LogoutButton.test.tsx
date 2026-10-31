import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import LogoutButton from '@/components/studio/LogoutButton'
import {renderWithLocale} from '@/lib/i18n/testUtils'

const {push, clearSessionTokens, clearAllCachedTenantData} = vi.hoisted(() => ({
    push: vi.fn(),
    clearSessionTokens: vi.fn(),
    clearAllCachedTenantData: vi.fn(),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({push})}))
vi.mock('@/lib/auth/MeProvider', () => ({useOptionalMe: () => null}))
vi.mock('@/lib/auth/session', () => ({clearSessionTokens}))
vi.mock('@directwerk/api/client/useCachedTenantQuery', () => ({clearAllCachedTenantData}))
vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

describe('LogoutButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', vi.fn())
        window.localStorage.clear()
        document.documentElement.classList.remove('light', 'dark')
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('clears local auth state and redirects only after a successful logout', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, {status: 204}))

        renderWithLocale(<LogoutButton />)
        fireEvent.click(screen.getByRole('button', {name: 'Abmelden'}))

        await waitFor(() => expect(push).toHaveBeenCalledWith('/de/login'))
        expect(clearSessionTokens).toHaveBeenCalledOnce()
        expect(clearAllCachedTenantData).toHaveBeenCalledOnce()
        expect(fetch).toHaveBeenCalledWith(
            '/api/auth/logout',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({'X-Tenant-Host': 'tenant.test'}),
            }),
        )
    })

    it.each([
        ['a non-OK response', () => Promise.resolve(new Response(null, {status: 503}))],
        ['a transport error', () => Promise.reject(new TypeError('network down'))],
    ])('preserves local auth state after %s', async (_label, response) => {
        vi.mocked(fetch).mockImplementation(response)

        renderWithLocale(<LogoutButton />)
        fireEvent.click(screen.getByRole('button', {name: 'Abmelden'}))

        expect(await screen.findByRole('alert')).toHaveTextContent('Abmeldung fehlgeschlagen')
        expect(clearSessionTokens).not.toHaveBeenCalled()
        expect(clearAllCachedTenantData).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })

    it('toggles light/dark theme from the footer control', () => {
        document.documentElement.classList.add('light')
        renderWithLocale(<LogoutButton publicSiteUrl="https://demo.example" />)

        fireEvent.click(screen.getByRole('button', {name: 'Zum dunklen Modus wechseln'}))

        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(window.localStorage.getItem('dw.studio.theme')).toBe('dark')

        fireEvent.click(screen.getByRole('button', {name: 'Zum hellen Modus wechseln'}))

        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(window.localStorage.getItem('dw.studio.theme')).toBe('light')
    })

    it('links to the tenant public site when configured', () => {
        renderWithLocale(<LogoutButton publicSiteUrl="https://demo.example/" />)

        // Base UI Button with render=<a> keeps role="button" while remaining an anchor.
        const link = screen.getByRole('button', {name: 'Öffentliche Seite öffnen'})
        expect(link.tagName).toBe('A')
        expect(link).toHaveAttribute('href', 'https://demo.example')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('disables the public site control when no URL is configured', () => {
        renderWithLocale(<LogoutButton publicSiteUrl={null} />)

        expect(
            screen.getByRole('button', {name: 'Öffentliche Site-URL ist noch nicht konfiguriert'}),
        ).toBeDisabled()
        expect(screen.queryByRole('button', {name: 'Öffentliche Seite öffnen'})).toBeNull()
    })
})
