'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import type {ReactNode} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'

export interface DeskStep {
    id: string
    title: string
    description: string
    done: boolean
    href: string
    actionLabel: string
    primary?: boolean
}

/**
 * Shared skeleton of the write and podcast desk landings (issue #691): header with actions,
 * optional error, the "how this works" step list, an optional empty state, open drafts and
 * footer links. Content-specific data and labels come in as props.
 */
export default function DeskLanding({
    eyebrow,
    title,
    description,
    actions,
    errorMessage,
    flowId,
    flowTitle,
    flowDescription,
    steps,
    activatePrimary,
    emptyState,
    drafts,
    extra,
    footer,
}: {
    eyebrow: string
    title: string
    description: string
    actions: ReactNode
    errorMessage: string | null
    flowId: string
    flowTitle: string
    flowDescription: string
    steps: DeskStep[]
    /** Whether the step marked `primary` may render as the primary action. */
    activatePrimary: boolean
    emptyState?: {title: string; description: string; actionLabel: string; actionHref: string}
    drafts?: {
        title: string
        items: EntityListViewItem[]
        viewMode: ViewMode
        onViewModeChange: (mode: ViewMode) => void
        showAllHref: string
        showAllLabel: string
    }
    extra?: ReactNode
    footer?: ReactNode
}): React.JSX.Element {
    const dict = useDictionary()

    return (
        <PageStack>
            <PageHeader
                actions={actions}
                description={description}
                eyebrow={eyebrow}
                title={title}
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            <section aria-labelledby={flowId} className="flex flex-col gap-4">
                <SectionHeader description={flowDescription} id={flowId} title={flowTitle} />
                <ol className="grid gap-3">
                    {steps.map((step) => (
                        <li
                            key={step.id}
                            className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{step.title}</p>
                                    <Badge variant={step.done ? 'secondary' : 'outline'}>
                                        {step.done ? dict.common.done : dict.common.openStep}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href={step.href} />}
                                size="sm"
                                variant={
                                    step.primary && activatePrimary
                                        ? 'default'
                                        : step.done
                                          ? 'outline'
                                          : 'secondary'
                                }
                            >
                                {step.actionLabel}
                            </Button>
                        </li>
                    ))}
                </ol>
            </section>

            {emptyState !== undefined ? (
                <EmptyState
                    title={emptyState.title}
                    description={emptyState.description}
                    action={
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href={emptyState.actionHref} />}
                        >
                            {emptyState.actionLabel}
                        </Button>
                    }
                />
            ) : null}

            {drafts !== undefined && drafts.items.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title={drafts.title} />
                    <EntityListSection
                        items={drafts.items}
                        linkComponent={LocaleLink}
                        onViewModeChange={drafts.onViewModeChange}
                        showSelection={false}
                        viewMode={drafts.viewMode}
                    />
                    {drafts.items.length > 5 ? (
                        <p className="text-sm text-muted-foreground">
                            <LocaleLink href={drafts.showAllHref}>{drafts.showAllLabel}</LocaleLink>
                        </p>
                    ) : null}
                </section>
            ) : null}

            {extra}

            {footer !== undefined ? (
                <p className="text-sm text-muted-foreground">{footer}</p>
            ) : null}
        </PageStack>
    )
}
