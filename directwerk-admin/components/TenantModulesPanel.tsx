'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {useRouter} from 'next/navigation'

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
import {AUTH_REQUIRED, REQUEST_FAILED} from '@directwerk/api/constants'
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

function presetLabel(preset: ModulePresetKey): string {
    return preset
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export default function TenantModulesPanel({tenantId}: TenantModulesPanelProps) {
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const [catalog, setCatalog] = useState<ModuleDescriptor[]>([])
    const [enabled, setEnabled] = useState<Set<string>>(new Set())
    const [activations, setActivations] = useState<TenantModuleActivation[]>([])
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)

    const loadModules = useCallback(() => {
        let isCurrent = true
        setError(null)
        setIsLoading(true)

        loadTenantModulesPanelData(tenantId)
            .then(({catalog: modules, enabledModules, activations: activationRows}) => {
                if (!isCurrent) {
                    return
                }

                setCatalog(modules)
                setEnabled(enabledModules)
                setActivations(activationRows)
                setIsLoading(false)
            })
            .catch((requestError: unknown) => {
                if (!isCurrent) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    routerRef.current.replace('/login')
                    return
                }

                setError('Could not load modules.')
                setIsLoading(false)
            })

        return () => {
            isCurrent = false
        }
    }, [tenantId])

    useEffect(() => {
        return loadModules()
    }, [loadModules])

    async function runMutation(
        key: string,
        action: () => Promise<TenantModules>,
        successMessage: string,
    ): Promise<void> {
        setBusyKey(key)
        setError(null)
        setStatus(null)

        try {
            const result = await action()
                setEnabled(new Set(result.enabledModules))
                setActivations(result.activations ?? [])
                setStatus(successMessage)
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                routerRef.current.replace('/login')
                return
            }

            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                setError(
                    'Module update failed. Check dependencies or try again.',
                )
                return
            }

            setError('Module update is unavailable. Try again later.')
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
                <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
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
