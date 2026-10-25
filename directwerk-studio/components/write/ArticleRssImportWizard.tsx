'use client'

import RssImportWizardShared from '@/components/publication/rss-import/RssImportWizardShared'
import {articleRssImportConfig} from '@/components/publication/rss-import/configs'

export default function ArticleRssImportWizard(): React.JSX.Element {
    return <RssImportWizardShared config={articleRssImportConfig} />
}
