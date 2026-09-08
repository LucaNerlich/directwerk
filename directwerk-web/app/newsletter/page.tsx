import NewsletterIndexClient from '@/components/newsletter/NewsletterIndexClient'
import {fetchPublicNewsletterListsServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export default async function NewsletterSubscribePage(): Promise<React.JSX.Element> {
    let initialLists: Awaited<ReturnType<typeof fetchPublicNewsletterListsServer>> | null = null
    try {
        const host = await getTenantHost()
        if (host !== null) {
            initialLists = await fetchPublicNewsletterListsServer(host)
        }
    } catch {
        initialLists = null
    }

    return <NewsletterIndexClient initialLists={initialLists} />
}
