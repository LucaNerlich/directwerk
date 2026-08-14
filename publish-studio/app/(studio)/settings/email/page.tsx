'use client'

import {hasModule} from '@/lib/api/client'
import EmailTemplatesClient from '@/components/settings/EmailTemplatesClient'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function EmailTemplatesPage(): React.JSX.Element {
    const config = useSiteConfig()
    const enabled = hasModule(config, 'EMAIL_NOTIFY')

    return (
        <TenantAdminGuard>
            {enabled ? (
                <>
                    {config.emailNotifyAvailable ? null : (
                        <p>
                            E-Mail-Versand ist auf der Plattform deaktiviert.
                            Die Option „Abonnenten benachrichtigen“ bleibt
                            beim Veröffentlichen ausgeblendet.
                        </p>
                    )}
                    <EmailTemplatesClient />
                </>
            ) : (
                <div>
                    <h1>E-Mail-Vorlagen</h1>
                    <p>
                        Das Modul <code>EMAIL_NOTIFY</code> ist für diesen Tenant
                        nicht aktiv.
                    </p>
                </div>
            )}
        </TenantAdminGuard>
    )
}
