import ArticleEditor from '@/components/write/ArticleEditor'

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
