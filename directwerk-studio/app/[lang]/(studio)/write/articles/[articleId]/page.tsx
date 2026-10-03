import {ArticleEditor} from '@/lib/dynamic/studioHeavy'

export default async function ArticleDetailPage({
    params,
}: {
    params: Promise<{articleId: string}>
}) {
    const {articleId: articleIdRaw} = await params
    const articleId = Number(articleIdRaw)
    if (!Number.isSafeInteger(articleId) || articleId < 1) {
        return <p>Ungültiger Beitrag.</p>
    }

    return <ArticleEditor articleId={articleId} />
}
