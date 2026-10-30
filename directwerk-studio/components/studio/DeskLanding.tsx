'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import SetupChecklist from '@/components/studio/SetupChecklist'
import type {SetupStep} from '@/lib/studio/setupStep'
import type {ReactNode} from 'react'
import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'

export type {SetupStep as DeskStep}

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
    steps: SetupStep[]
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
    const allDone = steps.every((step) => step.done)
    const [expanded, setExpanded] = useState(false)

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

            <SetupChecklist
                activatePrimary={activatePrimary}
                collapsed={allDone && !expanded}
                collapsedSummary={dict.shell.home.setup.deskCompleteSummary}
                description={flowDescription}
                id={flowId}
                onExpand={() => setExpanded(true)}
                steps={steps}
                title={flowTitle}
            />

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
