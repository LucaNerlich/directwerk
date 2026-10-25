'use client'

import PublicationContentEditor from '@/components/publication/content-editor/PublicationContentEditor'
import {useArticleContentEditor} from '@/components/publication/content-editor/useArticleContentEditor'

/**
 * @param articleId - The identifier of the article to edit; omit to create a new article
 */
export default function ArticleEditor({articleId}: {articleId?: number}) {
    const model = useArticleContentEditor(articleId)
    return <PublicationContentEditor model={model} />
}
