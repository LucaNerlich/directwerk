'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import {
    activateTenantModule,
    applyTenantModulePreset,
    deactivateTenantModule,
    loadTenantModulesPanelData,
} from '@/lib/api/platformModulesApi'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {REQUEST_FAILED} from '@directwerk/api/constants'
import type {
    ModuleDescriptor,
    ModulePresetKey,
    TenantModuleActivation,
    TenantModules,
} from '@directwerk/api/types'
import {MODULE_PRESETS} from '@directwerk/api/types'

interface TenantModulesPanelProps {
    tenantId: string
}

const EMPTY_ENABLED: ReadonlySet<string> = new Set()

/**
 * Converts a module preset key into title-style text.
 *
 * @param preset - The enum-style preset key to format
 * @returns The preset key with capitalized words separated by spaces
 */
function presetLabel(preset: ModulePresetKey): string {
    return preset.toLowerCase().split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
}

/**
 * Manages the platform modules enabled for a tenant.
 *
 * @param tenantId - The tenant whose modules are managed
 * @returns The tenant module management panel
 */
export default function TenantModulesPanel({tenantId}: TenantModulesPanelProps) {
    const authRedirect = useAuthRequired()
    const [mutationError, setMutationError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [busyKey, setBusyKey] = useState<string | null>(null)

    const {
        data,
        error: queryError,
        isLoading,
        reload: loadModules,
        setData,
    } = usePlatformQuery(() => loadTenantModulesPanelData(tenantId), {
        fallbackError: 'Could not load modules.',
        queryKey: `tenant-modules:${tenantId}`,
    })

    const error = mutationError ?? queryError
    const catalog: ModuleDescriptor[] = data?.catalog ?? []
    const enabled: ReadonlySet<string> = data?.enabledModules ?? EMPTY_ENABLED
    const activations: TenantModuleActivation[] = data?.activations ?? []

    // Switching tenants discards a stale mutation error from the previous one.
    useEffect(() => {
        setMutationError(null)
    }, [tenantId])

    function retryLoadModules(): void {
        setMutationError(null)
        loadModules()
    }

    async function runMutation(
        key: string,
        action: () => Promise<TenantModules>,
        successMessage: string,
    ): Promise<void> {
        setBusyKey(key)
        setMutationError(null)
        setStatus(null)

        try {
            const result = await action()
            setData((current) =>
                current
                    ? {
                          ...current,
                          enabledModules: new Set(result.enabledModules),
                          activations: result.activations ?? [],
                      }
                    : current,
            )
            setStatus(successMessage)
        } catch (requestError: unknown) {
            if (authRedirect(requestError)) {
                return
            }

            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                setMutationError(
                    'Module update failed. Check dependencies or try again.',
                )
                return
            }

            setMutationError('Module update is unavailable. Try again later.')
        } finally {
            setBusyKey(null)
        }
    }

    function handleActivate(moduleKey: string): void {
        void runMutation(
            moduleKey,
            () => activateTenantModule(tenantId, moduleKey),
            `Activated ${moduleKey}.`,
        )
    }

    function handleDeactivate(moduleKey: string): void {
        const confirmed = window.confirm(
            `Deactivate ${moduleKey}? Dependent modules are deactivated too.`,
        )
        if (!confirmed) {
            return
        }
        void runMutation(
            moduleKey,
            () => deactivateTenantModule(tenantId, moduleKey),
            `Deactivated ${moduleKey} (and any dependents).`,
        )
    }

    function handleApplyPreset(preset: ModulePresetKey): void {
        void runMutation(
            `preset:${preset}`,
            () => applyTenantModulePreset(tenantId, preset),
            `Applied preset ${preset}.`,
        )
    }

    const isBusy = busyKey !== null

    return (
        <Card aria-labelledby="tenant-modules-heading" role="region">
            <CardHeader>
                <CardTitle id="tenant-modules-heading">Modules</CardTitle>
                <CardDescription>
                    Enable platform modules per tenant. Modules with unmet
                    dependencies cannot be activated; deactivating a module
                    also deactivates its dependents.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

            {error ? (
                <>
                    <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                    <div>
                        <Button onClick={retryLoadModules} type="button" variant="outline">
                            Retry
                        </Button>
                    </div>
                </>
            ) : null}
            {status ? (
                <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
                    {status}
                </p>
            ) : null}

            {isLoading ? (
                <>
                    <div aria-hidden="true" className="space-y-2">
                        {[0, 1, 2].map((index) => (
                            <div className="flex items-center gap-4 rounded-xl border p-4" key={index}>
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="ml-auto h-8 w-24 shrink-0" />
                            </div>
                        ))}
                    </div>
                    <p aria-live="polite" className="text-sm text-muted-foreground">Loading modules…</p>
                </>
            ) : null}

            {!isLoading && catalog.length === 0 && !error ? (
                <EmptyState
                    description="The platform module catalog is empty."
                    title="No platform modules available"
                />
            ) : null}

            {!isLoading && catalog.length > 0 ? (
                <>
                    <ResponsiveTable label="Tenant modules">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">Module</TableHead>
                                <TableHead scope="col">Depends on</TableHead>
                                <TableHead scope="col">Status</TableHead>
                                <TableHead scope="col">
                                    <span className="sr-only">Actions</span>
                                    <span aria-hidden="true">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {catalog.map((module) => {
                                const isEnabled = enabled.has(module.moduleKey)
                                const missingDeps = module.dependsOn.filter(
                                    (dep) => !enabled.has(dep),
                                )
                                const rowBusy = busyKey === module.moduleKey

                                return (
                                    <TableRow key={module.moduleKey}>
                                        <TableCell className="whitespace-normal">
                                            <strong>{module.moduleKey}</strong>
                                            <span className="block text-sm">{module.name}</span>
                                            {module.description ? (
                                                <span className="block text-sm text-muted-foreground">
                                                    {module.description}
                                                </span>
                                            ) : null}
                                            {module.core ? (
                                                <Badge className="mt-1" variant="outline">Core</Badge>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {module.dependsOn.length > 0
                                                ? module.dependsOn.join(', ')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isEnabled ? 'default' : 'outline'}>{isEnabled ? 'Enabled' : 'Off'}</Badge>
                                            {!isEnabled &&
                                            missingDeps.length > 0 ? (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    Needs:{' '}
                                                    {missingDeps.join(', ')}
                                                </span>
                                            ) : null}
                                            {module.core ? (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    Always on.
                                                </span>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {isEnabled ? (
                                                <Button
                                                    disabled={
                                                        isBusy || module.core
                                                    }
                                                    onClick={() =>
                                                        handleDeactivate(
                                                            module.moduleKey,
                                                        )
                                                    }
                                                    title={module.core ? 'Core modules cannot be deactivated.' : undefined}
                                                    type="button"
                                                    variant="destructive"
                                                >
                                                    {rowBusy
                                                        ? 'Working…'
                                                        : 'Deactivate'}
                                                </Button>
                                            ) : (
                                                <Button
                                                    disabled={
                                                        isBusy ||
                                                        missingDeps.length > 0
                                                    }
                                                    onClick={() =>
                                                        handleActivate(
                                                            module.moduleKey,
                                                        )
                                                    }
                                                    title={missingDeps.length > 0 ? `Enable first: ${missingDeps.join(', ')}.` : undefined}
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {rowBusy
                                                        ? 'Working…'
                                                        : 'Activate'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    </ResponsiveTable>

                    <SectionHeader
                        description="Presets activate a set of modules (dependencies first). They never deactivate modules outside the preset."
                        title="Apply preset"
                    />
                    <div className="flex flex-wrap gap-2">
                        {MODULE_PRESETS.map((preset) => (
                            <Button
                                    disabled={isBusy}
                                    key={preset}
                                    onClick={() => handleApplyPreset(preset)}
                                    type="button"
                                    variant="outline"
                                >
                                    {busyKey === `preset:${preset}`
                                        ? 'Applying…'
                                        : presetLabel(preset)}
                            </Button>
                        ))}
                    </div>

                    {activations.length > 0 ? (
                        <>
                            <SectionHeader
                                description="How each module was enabled for this tenant."
                                title="Activation log"
                            />
                            <ResponsiveTable label="Module activation log">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">Module</TableHead>
                                        <TableHead scope="col">Active</TableHead>
                                        <TableHead scope="col">Source</TableHead>
                                        <TableHead scope="col">Activated</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activations.map((activation) => (
                                        <TableRow key={activation.moduleKey}>
                                            <TableCell>{activation.moduleKey}</TableCell>
                                            <TableCell>
                                                <Badge variant={activation.active ? 'default' : 'outline'}>
                                                    {activation.active ? 'Yes' : 'No'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{activation.source}</TableCell>
                                            <TableCell>
                                                {new Date(activation.activatedAt).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </ResponsiveTable>
                        </>
                    ) : null}
                </>
            ) : null}
            </CardContent>
        </Card>
    )
}
