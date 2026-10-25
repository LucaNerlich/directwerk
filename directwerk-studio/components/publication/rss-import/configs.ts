'use client'

import {useArticleRssImportAdapter} from './useArticleRssImportAdapter'
import {usePodcastRssImportAdapter} from './usePodcastRssImportAdapter'
import type {RssImportWizardConfig} from './types'

export const articleRssImportConfig: RssImportWizardConfig = {
    useAdapter: useArticleRssImportAdapter,
}

export const podcastRssImportConfig: RssImportWizardConfig = {
    useAdapter: usePodcastRssImportAdapter,
}
