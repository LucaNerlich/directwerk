'use client'

import {ArrowLeftRightIcon, ExternalLinkIcon} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {ButtonGroup} from '@directwerk/ui/components/button-group'
import {clearAllCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {publicSiteOrigin} from '@directwerk/api/urls/publicContentUrls'
import {
    clearTenantHostCookieInDocument,
    getClientTenantHost,
} from '@directwerk/api/tenant'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {clearSelectedTenantHost} from '@/lib/api/authApi'
import {t} from '@/lib/i18n/dictionary'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {clearSessionTokens} from '@/lib/auth/session'
import {safeLinkHref} from '@/lib/url/safeUrl'

async function endStudioSession(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Host': getClientTenantHost(),
            },
            body: '{}',
        })
        return response.ok
    } catch {
        return false
    }
}

export default function LogoutButton({
    publicSiteUrl = null,
}: {
    /** Tenant public -web origin from site config; null when not configured. */
    publicSiteUrl?: string | null
}) {
    const router = useRouter()
    const me = useOptionalMe()
    const dict = useDictionary()
    const localize = useLocalizedPath()
    const [actionError, setActionError] = useState<string | null>(null)
    const publicHref = safeLinkHref(publicSiteOrigin(publicSiteUrl))

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {me !== null ? (
                <p className="truncate px-1 text-xs text-muted-foreground" title={me.email}>
                    {t(dict.shell.signedInAs, {email: me.email})}
                </p>
            ) : null}
            {actionError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            ) : null}
            <div className="flex min-w-0 items-stretch gap-2">
                <ButtonGroup
                    aria-label={dict.shell.accountActionsAria}
                    className="min-w-0 flex-1"
                >
                    <Button
                        type="button"
                        className="min-w-0 flex-1"
                        size="icon-sm"
                        title={dict.shell.switchWorkspace}
                        variant="outline"
                        aria-label={dict.shell.switchWorkspace}
                        onClick={() => {
                            void (async () => {
                                setActionError(null)
                                const loggedOut = await endStudioSession()
                                if (!loggedOut) {
                                    setActionError(dict.shell.switchWorkspaceFailed)
                                    return
                                }
                                try {
                                    await clearSelectedTenantHost()
                                } catch {
                                    // Cookie clear via document below is enough for the login picker.
                                }
                                clearTenantHostCookieInDocument()
                                clearSessionTokens()
                                clearAllCachedTenantData()
                                router.push(localize('/login'))
                            })()
                        }}
                    >
                        <ArrowLeftRightIcon />
                    </Button>
                    {publicHref !== null ? (
                        <Button
                            className="min-w-0 flex-1"
                            size="icon-sm"
                            title={dict.shell.openPublicSite}
                            variant="outline"
                            aria-label={dict.shell.openPublicSite}
                            nativeButton={false}
                            render={
                                <a
                                    href={publicHref}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                />
                            }
                        >
                            <ExternalLinkIcon />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            className="min-w-0 flex-1"
                            disabled
                            size="icon-sm"
                            title={dict.shell.publicSiteUnavailable}
                            variant="outline"
                            aria-label={dict.shell.publicSiteUnavailable}
                        >
                            <ExternalLinkIcon />
                        </Button>
                    )}
                </ButtonGroup>
                <Button
                    type="button"
                    className="min-w-0 flex-1 justify-start"
                    variant="outline"
                    onClick={() => {
                        void (async () => {
                            setActionError(null)
                            const loggedOut = await endStudioSession()
                            if (!loggedOut) {
                                setActionError(dict.shell.logoutFailed)
                                return
                            }
                            clearSessionTokens()
                            clearAllCachedTenantData()
                            router.push(localize('/login'))
                        })()
                    }}
                >
                    {dict.shell.logout}
                </Button>
            </div>
        </div>
    )
}
