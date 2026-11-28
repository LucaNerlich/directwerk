import {render} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import UmamiAnalytics from './UmamiAnalytics'

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
    it('keeps query strings out of the reported URL', () => {
        const {getAllByTestId} = render(<UmamiAnalytics analytics={analytics} />)

        const scripts = getAllByTestId('umami-script')
        expect(scripts).toHaveLength(2)
        for (const script of scripts) {
            expect(script.getAttribute('data-exclude-search')).toBe('true')
        }
    })
})
