'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'
import SectionHeader from '@directwerk/ui/components/section-header'

import DeletePublicationDialog, {
    type DeletePublicationItem,
} from '@/components/publication/DeletePublicationDialog'

/**
 * Danger zone for the episode/article editors: delete with the shared
 * confirm rules (typed slug for PUBLISHED/SCHEDULED, simple confirm
 * otherwise), a German error with an explicit retry, and a redirect
 * callback on success.
 */
export default function PublicationDangerZone({
    item,
    contentLabel,
    deleteErrorMessage,
    onDelete,
    onDeleted,
}: {
    item: DeletePublicationItem | null
    contentLabel: string
    deleteErrorMessage: string
    onDelete: (id: number) => Promise<void>
    onDeleted: () => void
}): React.JSX.Element | null {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    if (item === null) {
        return null
    }

    const runDelete = async (): Promise<void> => {
        setPending(true)
        setErrorMessage(null)
        try {
            await onDelete(item.id)
            onDeleted()
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : deleteErrorMessage,
            )
        } finally {
            setPending(false)
            setDialogOpen(false)
        }
    }

    const retryDelete = (): void => {
        setDialogOpen(true)
    }

    return (
        <section aria-labelledby="publication-danger-zone-heading">
            <Card className="border-destructive/40">
                <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
                    <SectionHeader
                        description="Endgültig und unwiderruflich — incl. aller Veröffentlichungen im Feed."
                        id="publication-danger-zone-heading"
                        title="Gefahrenzone"
                    />
                    {errorMessage !== null ? (
                        <Alert variant="destructive">
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            disabled={pending}
                            onClick={() => setDialogOpen(true)}
                            type="button"
                            variant="destructive"
                        >
                            {`${contentLabel} löschen…`}
                        </Button>
                        {errorMessage !== null ? (
                            <Button
                                disabled={pending}
                                onClick={retryDelete}
                                type="button"
                                variant="outline"
                            >
                                Erneut versuchen
                            </Button>
                        ) : null}
                    </div>
                    <DeletePublicationDialog
                        contentLabel={contentLabel}
                        item={item}
                        onConfirm={() => void runDelete()}
                        onOpenChange={setDialogOpen}
                        open={dialogOpen}
                        pending={pending}
                    />
                </CardContent>
            </Card>
        </section>
    )
}
