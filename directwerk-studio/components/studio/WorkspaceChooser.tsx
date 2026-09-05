'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import type {StudioWorkspace} from '@directwerk/api/types'

interface WorkspaceChooserProps {
    workspaces: StudioWorkspace[]
    /** Host of the workspace currently being opened; `null` when idle. */
    openingHost: string | null
    error: string | null
    onSelect: (workspace: StudioWorkspace) => void
    onBack: () => void
}

function workspaceInitial(name: string): string {
    const trimmed = name.trim()
    return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?'
}

/**
 * Step 2 of studio login: pick which discovered workspace (tenant) to open.
 * Each row shows the tenant at a glance (avatar initial, name, host) and
 * reports its own opening state so the choice stays responsive for multi-
 * workspace accounts.
 */
export default function WorkspaceChooser({
    workspaces,
    openingHost,
    error,
    onSelect,
    onBack,
}: WorkspaceChooserProps): React.JSX.Element {
    const isOpening = openingHost !== null

    return (
        <div className="grid gap-4">
            <ul aria-label="Verfügbare Workspaces" className="grid gap-2">
                {workspaces.map((workspace) => {
                    const isActive = openingHost === workspace.host
                    return (
                        <li key={workspace.tenantId}>
                            <Button
                                aria-label={`${workspace.name} (${workspace.host}) öffnen`}
                                className="h-auto w-full justify-start gap-3 p-3 text-left"
                                disabled={isOpening}
                                onClick={() => {
                                    onSelect(workspace)
                                }}
                                type="button"
                                variant="outline"
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
                                >
                                    {workspaceInitial(workspace.name)}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                                    <span className="w-full truncate font-medium">
                                        {workspace.name}
                                    </span>
                                    <span
                                        className="w-full truncate text-xs text-muted-foreground"
                                        title={workspace.host}
                                    >
                                        {workspace.host}
                                    </span>
                                </span>
                                {isActive ? (
                                    <span
                                        aria-live="polite"
                                        className="shrink-0 text-xs text-muted-foreground"
                                        role="status"
                                    >
                                        Wird geöffnet…
                                    </span>
                                ) : null}
                            </Button>
                        </li>
                    )
                })}
            </ul>
            {error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <Button
                disabled={isOpening}
                onClick={onBack}
                type="button"
                variant="ghost"
            >
                Zurück
            </Button>
        </div>
    )
}
