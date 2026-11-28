import {render} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import UmamiAnalytics from './UmamiAnalytics'

let currentPath = '/de'
vi.mock('next/navigation', () => ({usePathname: () => currentPath}))

vi.mock('next/script', () => ({
    default: ({src, ...props}: Record<string, unknown>) => (
        <div data-script-src={String(src)} data-testid="umami-script" {...props} />
    ),
}))

const analytics = {
    umamiHostUrl: 'https://analytics.example.com',
    umamiScriptUrl: 'https://analytics.example.com/script.js',
    umamiWebsiteId: 'website-id',
} as Parameters<typeof UmamiAnalytics>[0]['analytics']

describe('UmamiAnalytics', () => {
    it('is not mounted on pages whose URL carries a one-time token', () => {
        currentPath = '/de/reset-password'
        const {queryAllByTestId} = render(<UmamiAnalytics analytics={analytics} />)
        expect(queryAllByTestId('umami-script')).toHaveLength(0)
        currentPath = '/de'
    })

    it('keeps query strings out of the reported URL', () => {
        const {getAllByTestId} = render(<UmamiAnalytics analytics={analytics} />)

        const scripts = getAllByTestId('umami-script')
        expect(scripts).toHaveLength(2)
        for (const script of scripts) {
            expect(script.getAttribute('data-exclude-search')).toBe('true')
        }
    })
})
