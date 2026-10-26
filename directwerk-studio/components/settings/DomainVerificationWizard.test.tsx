import {act, fireEvent, screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import DomainVerificationWizard, {
    isValidHostname,
} from '@/components/settings/DomainVerificationWizard'

const addDomain = vi.fn()
const getDomainVerification = vi.fn()
const verifyDomain = vi.fn()

vi.mock('@/lib/api/tenantSettingsApi', () => ({
    addDomain: (...args: unknown[]) => addDomain(...args),
    getDomainVerification: (...args: unknown[]) => getDomainVerification(...args),
    verifyDomain: (...args: unknown[]) => verifyDomain(...args),
}))

describe('isValidHostname', () => {
    it('accepts normal hosts and rejects malformed labels', () => {
        expect(isValidHostname('podcast.beispiel.de')).toBe(true)
        expect(isValidHostname('a..b.de')).toBe(false)
        expect(isValidHostname('localhost')).toBe(false)
    })
})

describe('DomainVerificationWizard', () => {
    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true})
        addDomain.mockReset()
        getDomainVerification.mockReset()
        verifyDomain.mockReset()
        Object.assign(navigator, {
            clipboard: {writeText: vi.fn().mockResolvedValue(undefined)},
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('walks add → dns → check → done with clear success', async () => {
        addDomain.mockResolvedValue({
            host: 'podcast.beispiel.de',
            primary: false,
            verified: false,
        })
        getDomainVerification.mockResolvedValue({
            host: 'podcast.beispiel.de',
            token: 'abc123',
            dnsTxtValue: 'directwerk-verify=abc123',
            dnsNameHint: '_directwerk-challenge.podcast.beispiel.de',
        })
        verifyDomain.mockResolvedValue({
            host: 'podcast.beispiel.de',
            primary: false,
            verified: true,
        })

        const onComplete = vi.fn()
        renderWithLocale(
            <DomainVerificationWizard
                onAuthError={() => false}
                onCancel={vi.fn()}
                onComplete={onComplete}
            />,
        )

        fireEvent.change(screen.getByLabelText('Host'), {
            target: {value: 'podcast.beispiel.de'},
        })
        fireEvent.click(screen.getByRole('button', {name: 'Weiter zu DNS'}))

        await waitFor(() => {
            expect(screen.getByText('_directwerk-challenge.podcast.beispiel.de')).toBeTruthy()
        })
        expect(screen.getByText('directwerk-verify=abc123')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', {name: 'Einmal prüfen'}))

        await waitFor(() => {
            expect(screen.getByText('Domain verifiziert')).toBeTruthy()
        })
        expect(screen.getByText('podcast.beispiel.de ist verifiziert.')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', {name: 'Fertig'}))
        expect(onComplete).toHaveBeenCalledWith('podcast.beispiel.de')
    })

    it('shows waiting state when DNS is not visible yet and keeps polling', async () => {
        getDomainVerification.mockResolvedValue({
            host: 'open.beispiel.de',
            token: 'tok',
            dnsTxtValue: 'directwerk-verify=tok',
            dnsNameHint: '_directwerk-challenge.open.beispiel.de',
        })
        const pending = Object.assign(new Error('Domain verification failed'), {
            code: 'DOMAIN_VERIFICATION_FAILED',
            status: 400,
        })
        verifyDomain.mockRejectedValue(pending)

        renderWithLocale(
            <DomainVerificationWizard
                initialHost="open.beispiel.de"
                onAuthError={() => false}
                onCancel={vi.fn()}
                onComplete={vi.fn()}
            />,
        )

        await waitFor(() => {
            expect(screen.getByText('_directwerk-challenge.open.beispiel.de')).toBeTruthy()
        })

        fireEvent.click(screen.getByRole('button', {name: 'Eintrag angelegt — prüfen'}))

        await waitFor(() => {
            expect(screen.getByText('Noch nicht sichtbar')).toBeTruthy()
        })

        expect(verifyDomain).toHaveBeenCalledTimes(1)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000)
        })

        await waitFor(() => {
            expect(verifyDomain.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
    })
})
