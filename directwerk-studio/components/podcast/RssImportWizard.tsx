'use client'

import RssImportWizardShared from '@/components/publication/rss-import/RssImportWizardShared'
import {podcastRssImportConfig} from '@/components/publication/rss-import/configs'

/**
 * Provides a multi-step wizard for importing podcast episodes from an RSS feed.
 */
export default function RssImportWizard(): React.JSX.Element {
    return <RssImportWizardShared config={podcastRssImportConfig} />
}
