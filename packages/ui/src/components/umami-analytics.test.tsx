import {render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import UmamiAnalytics from './umami-analytics'

vi.mock('next/script', () => ({
    default: ({src, ...rest}: {src: string; [key: string]: unknown}) => (
        <script src={src} {...rest} />
    ),
}))

afterEach(() => {
    vi.unstubAllEnvs()
})

function stubUmamiEnv(host: string): void {
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', `website-${host}`)
    vi.stubEnv('NEXT_PUBLIC_UMAMI_URL', `https://${host}`)
}

describe('UmamiAnalytics', () => {
    it('renders nothing without configuration', () => {
        vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', '')
        vi.stubEnv('NEXT_PUBLIC_UMAMI_URL', '')

        const {container} = render(<UmamiAnalytics />)

        expect(container.innerHTML).toBe('')
    })

    it('renders tracker and recorder with strict masking by default', () => {
        stubUmamiEnv('umami-default.example.com')

        render(<UmamiAnalytics />)

        const tracker = document.querySelector(
            'script[src="https://umami-default.example.com/script.js"]',
        )
        const recorder = document.querySelector(
            'script[src="https://umami-default.example.com/recorder.js"]',
        )
        expect(tracker?.getAttribute('data-website-id')).toBe(
            'website-umami-default.example.com',
        )
        expect(recorder?.getAttribute('data-mask-level')).toBe('strict')
        expect(recorder?.getAttribute('data-sample-rate')).toBe('0.25')
        expect(recorder?.getAttribute('data-max-duration')).toBe('300000')
    })

    it('honours a custom mask level', () => {
        stubUmamiEnv('umami-moderate.example.com')

        render(<UmamiAnalytics maskLevel="moderate" />)

        expect(
            document
                .querySelector(
                    'script[src="https://umami-moderate.example.com/recorder.js"]',
                )
                ?.getAttribute('data-mask-level'),
        ).toBe('moderate')
    })
})
