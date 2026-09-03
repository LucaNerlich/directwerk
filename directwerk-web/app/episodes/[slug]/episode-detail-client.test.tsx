import {render} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import type {PublicEpisode} from '@directwerk/api/types'

import EpisodeDetailClient from './episode-detail-client'

const MALICIOUS_DESCRIPTION =
    '<p>Hörbarer Text</p>' +
    '<script>alert("stored-xss")</script>' +
    '<p onclick="alert(1)">Klick mich</p>' +
    '<svg onload="alert(2)"><circle r="10" /></svg>'

function buildEpisode(description: string): PublicEpisode {
    return {
        id: 7,
        seriesId: 3,
        seriesSlug: 'sichere-serie',
        episodeNumber: 1,
        slug: 'sichere-folge',
        title: 'Sichere Folge',
        description,
        durationSeconds: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: null,
        audioCdnUrl: null,
    }
}

describe('EpisodeDetailClient content rendering', () => {
    it('sanitizes stored episode HTML before injecting it into the DOM', () => {
        const {container} = render(
            <EpisodeDetailClient
                slug="sichere-folge"
                initialPublicEpisode={buildEpisode(MALICIOUS_DESCRIPTION)}
            />,
        )

        expect(container.querySelector('script')).toBeNull()
        expect(container.querySelector('svg')).toBeNull()
        expect(container.innerHTML).not.toContain('onclick')
        expect(container.innerHTML).not.toContain('onload')
        expect(container.textContent).toContain('Hörbarer Text')
    })
})
