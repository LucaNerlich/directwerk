import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import LoginForm, {resolvePostLoginPath} from '@/app/login/LoginForm'

const replaceMock = vi.fn()
const loginAction = vi.fn()
const storeTokens = vi.fn()
const invalidatePendingRefresh = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({replace: replaceMock}),
}))

vi.mock('./actions', () => ({
    loginAction: (...args: unknown[]) => loginAction(...args),
}))

vi.mock('@/lib/auth/session', () => ({
    invalidatePendingRefresh: (...args: unknown[]) =>
        invalidatePendingRefresh(...args),
}))

vi.mock('@/lib/auth/tokenStore', () => ({
    storeTokens: (...args: unknown[]) => storeTokens(...args),
}))

beforeEach(() => {
    window.history.pushState({}, '', '/login')
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.history.pushState({}, '', '/login')
})

describe('resolvePostLoginPath', () => {
    it('honors safe same-origin deep links', () => {
        expect(resolvePostLoginPath('?next=/tenants/7')).toBe('/tenants/7')
        expect(resolvePostLoginPath('?next=/jobs?status=FAILED')).toBe(
            '/jobs?status=FAILED'
        )
    })

    it('falls back to the overview for missing or unsafe targets', () => {
        expect(resolvePostLoginPath('')).toBe('/')
        expect(resolvePostLoginPath('?next=https://evil.test/x')).toBe('/')
        expect(resolvePostLoginPath('?next=//evil.test/x')).toBe('/')
        expect(resolvePostLoginPath('?next=javascript:alert(1)')).toBe('/')
    })
})

describe('LoginForm', () => {
    it('redirects to the captured deep link after a successful login', async () => {
        const user = userEvent.setup()
        window.history.pushState({}, '', '/login?next=/tenants/7')
        loginAction.mockResolvedValue({
            error: null,
            tokens: {access_token: 'access', expires_in: 900},
        })
        render(<LoginForm />)

        await user.type(screen.getByLabelText('Email'), 'admin@directwerk.local')
        await user.type(screen.getByLabelText('Password'), 'secret')
        await user.click(screen.getByRole('button', {name: 'Sign in'}))

        await waitFor(() => expect(loginAction).toHaveBeenCalled())
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/tenants/7'))
        expect(storeTokens).toHaveBeenCalled()
        expect(invalidatePendingRefresh).toHaveBeenCalled()
    })

    it('falls back to the overview for an unsafe deep link', async () => {
        const user = userEvent.setup()
        window.history.pushState({}, '', '/login?next=https://evil.test/x')
        loginAction.mockResolvedValue({
            error: null,
            tokens: {access_token: 'access', expires_in: 900},
        })
        render(<LoginForm />)

        await user.type(screen.getByLabelText('Email'), 'admin@directwerk.local')
        await user.type(screen.getByLabelText('Password'), 'secret')
        await user.click(screen.getByRole('button', {name: 'Sign in'}))

        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
    })

    it('renders login errors without redirecting', async () => {
        const user = userEvent.setup()
        loginAction.mockResolvedValue({
            error: 'Login failed. Check your credentials.',
            tokens: null,
        })
        render(<LoginForm />)

        await user.type(screen.getByLabelText('Email'), 'admin@directwerk.local')
        await user.type(screen.getByLabelText('Password'), 'wrong')
        await user.click(screen.getByRole('button', {name: 'Sign in'}))

        await waitFor(() =>
            expect(
                screen.getByText('Login failed. Check your credentials.')
            ).toBeInTheDocument()
        )
        expect(replaceMock).not.toHaveBeenCalled()
        expect(storeTokens).not.toHaveBeenCalled()
    })
})
