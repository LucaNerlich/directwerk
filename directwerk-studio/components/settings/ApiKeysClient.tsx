'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import ConfirmDialog from '@directwerk/ui/components/confirm-dialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {ToggleGroup, ToggleGroupItem} from '@directwerk/ui/components/toggle-group'
import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'
import type {CreatedTenantApiKey, TenantApiKey, TenantApiKeyScope} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useCallback, useEffect, useState} from 'react'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {createApiKey, listApiKeys, revokeApiKey} from '@/lib/api/apiKeysApi'

type McpTransport = 'remote' | 'stdio'
type McpClient = 'claude' | 'opencode'

export default function ApiKeysClient({mcpUrl}: {mcpUrl: string}): React.JSX.Element {
    const dict = useDictionary()
    const s = dict.settings
    const authRedirect = useAuthRequired()
    const {state: copyState, copy} = useCopyToClipboard()
    const {state: mcpCopyState, copy: copyMcpConfig} = useCopyToClipboard()
    const [mcpTransport, setMcpTransport] = useState<McpTransport>('remote')
    const [mcpClient, setMcpClient] = useState<McpClient>('claude')
    const tenantHost = getClientTenantHost()
    const mcpConfig = buildMcpConfig({
        transport: mcpTransport,
        client: mcpClient,
        mcpUrl,
        tenantHost,
    })

    const [keys, setKeys] = useState<TenantApiKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [createOpen, setCreateOpen] = useState(false)
    const [name, setName] = useState('')
    const [scopeRead, setScopeRead] = useState(true)
    const [scopeWrite, setScopeWrite] = useState(true)
    const [creating, setCreating] = useState(false)
    const [created, setCreated] = useState<CreatedTenantApiKey | null>(null)

    const [revokeTarget, setRevokeTarget] = useState<TenantApiKey | null>(null)
    const [revoking, setRevoking] = useState(false)

    const reload = useCallback(async (): Promise<void> => {
        const result = await listApiKeys()
        setKeys(result)
    }, [])

    useEffect(() => {
        let active = true
        reload()
            .then(() => {
                if (!active) return
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) return
                if (authRedirect(error)) return
                setLoadError(error instanceof Error ? error.message : s.apiKeysLoadError)
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [reload, authRedirect, s.apiKeysLoadError])

    function openCreate(): void {
        setErrorMessage(null)
        setStatusMessage(null)
        setName('')
        setScopeRead(true)
        setScopeWrite(true)
        setCreated(null)
        setCreateOpen(true)
    }

    async function handleCreate(): Promise<void> {
        const trimmed = name.trim()
        if (!trimmed) {
            setErrorMessage(s.apiKeysNameRequired)
            return
        }
        const scopes: TenantApiKeyScope[] = []
        if (scopeRead) scopes.push('content:read')
        if (scopeWrite) scopes.push('content:write')
        if (scopes.length === 0) {
            setErrorMessage(s.apiKeysScopeRequired)
            return
        }
        setCreating(true)
        setErrorMessage(null)
        try {
            const result = await createApiKey({name: trimmed, scopes})
            setCreated(result)
            await reload()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(error instanceof Error ? error.message : s.apiKeysCreateError)
        } finally {
            setCreating(false)
        }
    }

    async function handleRevoke(): Promise<void> {
        if (revokeTarget === null) return
        setRevoking(true)
        setErrorMessage(null)
        try {
            const revokedName = revokeTarget.name
            await revokeApiKey(revokeTarget.id)
            setRevokeTarget(null)
            setStatusMessage(t(s.apiKeysRevokeDescription, {name: revokedName}))
            await reload()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(error instanceof Error ? error.message : s.apiKeysRevokeError)
        } finally {
            setRevoking(false)
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title={s.apiKeysTitle}
                    description={s.apiKeysDescription}
                />
                <p className="text-sm text-muted-foreground" role="status">
                    {dict.common.loading}
                </p>
                <Skeleton className="h-20 w-full" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title={s.apiKeysTitle}
                    description={s.apiKeysDescription}
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.settings}
                title={s.apiKeysTitle}
                description={s.apiKeysDescription}
                actions={
                    <Button type="button" onClick={openCreate}>
                        {s.apiKeysCreate}
                    </Button>
                }
            />

            {statusMessage ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}
            {errorMessage && !createOpen ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {keys.length === 0 ? (
                <EmptyState title={s.apiKeysEmpty} description={s.apiKeysEmptyDescription} />
            ) : (
                <ul className="divide-y rounded-md border">
                    {keys.map((key) => (
                        <li
                            key={key.id}
                            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0 space-y-1">
                                <p className="font-medium">{key.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {s.apiKeysPrefix}: dwk_{key.prefix}_…
                                    {' · '}
                                    {key.scopes.join(', ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {s.apiKeysCreatedAt}: {formatInstant(key.createdAt)}
                                    {' · '}
                                    {s.apiKeysLastUsed}:{' '}
                                    {key.lastUsedAt
                                        ? formatInstant(key.lastUsedAt)
                                        : s.apiKeysNeverUsed}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setStatusMessage(null)
                                    setRevokeTarget(key)
                                }}
                            >
                                {s.apiKeysRevoke}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>{s.apiKeysMcpTitle}</CardTitle>
                    <CardDescription>{s.apiKeysMcpDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                            <ToggleGroup
                                aria-label={s.apiKeysMcpTransportLabel}
                                className="rounded-lg border bg-muted/40 p-1"
                                onValueChange={(values) => {
                                    const next = values[0]
                                    if (next === 'remote' || next === 'stdio') {
                                        setMcpTransport(next)
                                    }
                                }}
                                size="sm"
                                spacing={0}
                                value={[mcpTransport]}
                                variant="outline"
                            >
                                <ToggleGroupItem value="remote">{s.apiKeysMcpRemote}</ToggleGroupItem>
                                <ToggleGroupItem value="stdio">{s.apiKeysMcpStdio}</ToggleGroupItem>
                            </ToggleGroup>
                            <ToggleGroup
                                aria-label={s.apiKeysMcpClientLabel}
                                className="rounded-lg border bg-muted/40 p-1"
                                onValueChange={(values) => {
                                    const next = values[0]
                                    if (next === 'claude' || next === 'opencode') {
                                        setMcpClient(next)
                                    }
                                }}
                                size="sm"
                                spacing={0}
                                value={[mcpClient]}
                                variant="outline"
                            >
                                <ToggleGroupItem value="claude">{s.apiKeysMcpClaude}</ToggleGroupItem>
                                <ToggleGroupItem value="opencode">OpenCode</ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                void copyMcpConfig(mcpConfig)
                            }}
                        >
                            {mcpCopyState === 'copied' ? s.apiKeysCopied : s.apiKeysCopy}
                        </Button>
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                        <code>{mcpConfig}</code>
                    </pre>
                    <p className="text-xs text-muted-foreground">
                        {mcpTransport === 'remote' ? s.apiKeysMcpRemoteHint : s.apiKeysMcpHint}
                    </p>
                    {mcpTransport === 'stdio' ? (
                        <p className="text-xs text-muted-foreground">{s.apiKeysMcpBuildHint}</p>
                    ) : null}
                </CardContent>
            </Card>

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    if (creating) return
                    setCreateOpen(open)
                    if (!open) {
                        setCreated(null)
                        setErrorMessage(null)
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {created ? s.apiKeysCreated : s.apiKeysCreate}
                        </DialogTitle>
                        <DialogDescription>
                            {created ? s.apiKeysCreatedHint : s.apiKeysDescription}
                        </DialogDescription>
                    </DialogHeader>

                    {created ? (
                        <div className="space-y-3">
                            <Label htmlFor="api-key-secret">{s.apiKeysSecret}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="api-key-secret"
                                    readOnly
                                    value={created.secret}
                                    className="font-mono text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        void copy(created.secret)
                                    }}
                                >
                                    {copyState === 'copied' ? s.apiKeysCopied : s.apiKeysCopy}
                                </Button>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setCreateOpen(false)
                                        setCreated(null)
                                    }}
                                >
                                    {s.apiKeysDone}
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {errorMessage ? (
                                <Alert variant="destructive">
                                    <AlertDescription>{errorMessage}</AlertDescription>
                                </Alert>
                            ) : null}
                            <div className="space-y-2">
                                <Label htmlFor="api-key-name">{s.apiKeysName}</Label>
                                <Input
                                    id="api-key-name"
                                    value={name}
                                    placeholder={s.apiKeysNamePlaceholder}
                                    onChange={(event) => setName(event.target.value)}
                                    maxLength={100}
                                    autoFocus
                                />
                            </div>
                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium">{s.apiKeysScopes}</legend>
                                <label className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={scopeRead}
                                        onChange={(event) => setScopeRead(event.target.checked)}
                                        className="mt-1"
                                    />
                                    <span>{s.apiKeysScopeRead}</span>
                                </label>
                                <label className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={scopeWrite}
                                        onChange={(event) => setScopeWrite(event.target.checked)}
                                        className="mt-1"
                                    />
                                    <span>{s.apiKeysScopeWrite}</span>
                                </label>
                            </fieldset>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={creating}
                                    onClick={() => setCreateOpen(false)}
                                >
                                    {s.apiKeysCancel}
                                </Button>
                                <Button
                                    type="button"
                                    disabled={creating}
                                    onClick={() => {
                                        void handleCreate()
                                    }}
                                >
                                    {creating ? s.apiKeysCreating : s.apiKeysCreate}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={revokeTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !revoking) setRevokeTarget(null)
                }}
                title={s.apiKeysRevokeTitle}
                description={
                    revokeTarget
                        ? t(s.apiKeysRevokeDescription, {name: revokeTarget.name})
                        : undefined
                }
                confirmLabel={s.apiKeysRevokeConfirm}
                cancelLabel={s.apiKeysCancel}
                pendingLabel={s.apiKeysRevoking}
                pending={revoking}
                destructive
                onConfirm={() => {
                    void handleRevoke()
                }}
            />
        </PageStack>
    )
}

function formatInstant(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}

function buildMcpConfig(options: {
    transport: McpTransport
    client: McpClient
    mcpUrl: string
    tenantHost: string
}): string {
    const host = options.tenantHost || 'your-tenant.example.com'
    if (options.transport === 'remote') {
        if (options.client === 'opencode') {
            return JSON.stringify(
                {
                    $schema: 'https://opencode.ai/config.json',
                    mcp: {
                        servers: {
                            'directwerk-studio': {
                                type: 'remote',
                                url: options.mcpUrl,
                                oauth: false,
                                headers: {
                                    Authorization: 'Bearer {env:DIRECTWERK_API_KEY}',
                                    'X-Tenant-Host': host,
                                },
                            },
                        },
                    },
                },
                null,
                2,
            )
        }
        return JSON.stringify(
            {
                mcpServers: {
                    'directwerk-studio': {
                        url: options.mcpUrl,
                        headers: {
                            Authorization: 'Bearer dwk_…',
                            'X-Tenant-Host': host,
                        },
                    },
                },
            },
            null,
            2,
        )
    }
    if (options.client === 'opencode') {
        return JSON.stringify(
            {
                $schema: 'https://opencode.ai/config.json',
                mcp: {
                    servers: {
                        'directwerk-studio': {
                            type: 'local',
                            command: ['node', '/absolute/path/to/packages/mcp-studio/dist/index.js'],
                            environment: {
                                DIRECTWERK_API_BASE_URL: 'https://api.example.com',
                                DIRECTWERK_API_KEY: '{env:DIRECTWERK_API_KEY}',
                                DIRECTWERK_TENANT_HOST: host,
                            },
                        },
                    },
                },
            },
            null,
            2,
        )
    }
    return JSON.stringify(
        {
            mcpServers: {
                'directwerk-studio': {
                    command: 'node',
                    args: ['/absolute/path/to/packages/mcp-studio/dist/index.js'],
                    env: {
                        DIRECTWERK_API_BASE_URL: 'https://api.example.com',
                        DIRECTWERK_API_KEY: 'dwk_…',
                        DIRECTWERK_TENANT_HOST: host,
                    },
                },
            },
        },
        null,
        2,
    )
}
