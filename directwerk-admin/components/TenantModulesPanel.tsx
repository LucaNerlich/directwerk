'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {useRouter} from 'next/navigation'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import {
    deletePlatformData,
    getPlatformData,
    postPlatformData,
} from '@/lib/api/client'
import {AUTH_REQUIRED, REQUEST_FAILED} from '@/lib/api/errors'
import type {
    ModuleDescriptor,
    ModulePresetKey,
    TenantModules,
} from '@/lib/api/types'
import {MODULE_PRESETS} from '@/lib/api/types'

interface TenantModulesPanelProps {
    tenantId: string
}

function isModuleDescriptor(value: unknown): value is ModuleDescriptor {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const module = value as Record<string, unknown>
    return (
        typeof module.moduleKey === 'string' &&
        typeof module.name === 'string' &&
        (module.description === undefined ||
            module.description === null ||
            typeof module.description === 'string') &&
        Array.isArray(module.dependsOn) &&
        module.dependsOn.every((item) => typeof item === 'string') &&
        typeof module.core === 'boolean'
    )
}

function isModuleCatalog(value: unknown): value is ModuleDescriptor[] {
    return Array.isArray(value) && value.every(isModuleDescriptor)
}

function isTenantModules(value: unknown): value is TenantModules {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const modules = value as Record<string, unknown>
    return (
        Array.isArray(modules.enabledModules) &&
        modules.enabledModules.every((item) => typeof item === 'string')
    )
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
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)

    const loadModules = useCallback(() => {
        let isCurrent = true
        setError(null)
        setIsLoading(true)

        Promise.all([
            getPlatformData<ModuleDescriptor[]>('modules'),
            getPlatformData<TenantModules>(`tenants/${tenantId}/modules`),
        ])
            .then(([modules, tenantModules]) => {
                if (!isCurrent) {
                    return
                }

                if (!isModuleCatalog(modules) || !isTenantModules(tenantModules)) {
                    setError('Could not load modules.')
                    setCatalog([])
                    setEnabled(new Set())
                    setIsLoading(false)
                    return
                }

                setCatalog(modules)
                setEnabled(new Set(tenantModules.enabledModules))
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
        successMessage: string
    ): Promise<void> {
        setBusyKey(key)
        setError(null)
        setStatus(null)

        try {
            const result = await action()
            if (!isTenantModules(result)) {
                setError('Module update failed. Try again later.')
                return
            }

            setEnabled(new Set(result.enabledModules))
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
                    'Module update failed. Check dependencies or try again.'
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
            () =>
                postPlatformData<TenantModules>(
                    `tenants/${tenantId}/modules/${moduleKey}/activate`,
                    {}
                ),
            `Activated ${moduleKey}.`
        )
    }

    function handleDeactivate(moduleKey: string): void {
        void runMutation(
            moduleKey,
            () =>
                deletePlatformData<TenantModules>(
                    `tenants/${tenantId}/modules/${moduleKey}`
                ),
            `Deactivated ${moduleKey} (and any dependents).`
        )
    }

    function handleApplyPreset(preset: ModulePresetKey): void {
        void runMutation(
            `preset:${preset}`,
            () =>
                postPlatformData<TenantModules>(
                    `tenants/${tenantId}/modules/preset/${preset}`,
                    {}
                ),
            `Applied preset ${preset}.`
        )
    }

    const isBusy = busyKey !== null

    return (
        <Card aria-labelledby="tenant-modules-heading" role="region">
            <CardHeader><CardTitle id="tenant-modules-heading">Modules</CardTitle></CardHeader>
            <CardContent className="space-y-5">

            {error ? (
                <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            ) : null}
            {status ? (
                <p aria-live="polite" role="status">
                    {status}
                </p>
            ) : null}

            {isLoading ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading modules…</p> : null}

            {!isLoading && catalog.length === 0 && !error ? (
                <EmptyState title="No platform modules available" />
            ) : null}

            {!isLoading && catalog.length > 0 ? (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">Module</TableHead>
                                <TableHead scope="col">Depends on</TableHead>
                                <TableHead scope="col">Status</TableHead>
                                <TableHead scope="col">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {catalog.map((module) => {
                                const isEnabled = enabled.has(module.moduleKey)
                                const missingDeps = module.dependsOn.filter(
                                    (dep) => !enabled.has(dep)
                                )
                                const rowBusy = busyKey === module.moduleKey

                                return (
                                    <TableRow key={module.moduleKey}>
                                        <TableCell className="whitespace-normal">
                                            <strong>{module.moduleKey}</strong>
                                            <br />
                                            {module.name}
                                            {module.description ? (
                                                <>
                                                    <br />
                                                    <small>{module.description}</small>
                                                </>
                                            ) : null}
                                            {module.core ? (
                                                <>
                                                    <br />
                                                    <small>Core</small>
                                                </>
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
                                                <>
                                                    <br />
                                                    <small>
                                                        Needs:{' '}
                                                        {missingDeps.join(', ')}
                                                    </small>
                                                </>
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
                                                            module.moduleKey
                                                        )
                                                    }
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
                                                            module.moduleKey
                                                        )
                                                    }
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

                    <h3>Apply preset</h3>
                    <p>
                        Presets activate a set of modules (dependencies first).
                        They do not deactivate modules outside the preset.
                    </p>
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
                </>
            ) : null}
            </CardContent>
        </Card>
    )
}
