export interface ArticlePublishChecklistInput {
    title: string
    body: string
}


export function articlePublishBlockReason(
    input: ArticlePublishChecklistInput,
): string | null {
    if (input.title.trim().length === 0) {
        return 'Titel fehlt.'
    }
    const plainBody = input.body.replace(/<[^>]*>/g, '').trim()
    if (plainBody.length === 0) {
        return 'Beitragstext fehlt.'
    }
    return null
}
