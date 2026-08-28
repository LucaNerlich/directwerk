import {hasModule} from '@/lib/api/client'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export default async function SubscriptionModuleGate({
    children,
}: {
    children: React.ReactNode
}): Promise<React.JSX.Element> {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)

    if (!hasModule(config, 'SUBSCRIPTION')) {
        return (
            <div>
                <h1>Abos</h1>
                <p>
                    Das Modul <code>SUBSCRIPTION</code> ist für diesen Tenant nicht
                    aktiv. Produkte und Freischaltungen sind daher nicht verfügbar.
                </p>
            </div>
        )
    }

    return <>{children}</>
}
