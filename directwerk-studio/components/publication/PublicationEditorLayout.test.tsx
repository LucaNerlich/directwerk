import {screen, within} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'

const renderContentHtml = vi.hoisted(() =>
    vi.fn((html: string) =>
        html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/\s*src="javascript:[^"]*"/gi, ''),
    ),
)

vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))
vi.mock('@/lib/dynamic/ShowNotesEditor', () => ({
    ShowNotesEditor: () => <div data-testid="show-notes-editor" />,
}))
vi.mock('@/components/studio/LevelSelect', () => ({
    default: () => <select aria-label="Mindest-Stufe" />,
}))
vi.mock('@directwerk/api/content/renderContentHtml', () => ({
    renderContentHtml,
}))

function renderLayout(body = '<p>Text</p>') {
    return renderWithLocale(
        <PublicationEditorLayout
            accessPolicy="FREE"
            body={body}
            errorMessage={null}
            isSaving={false}
            kind="article"
            notifySubscribers={false}
            onAccessPolicyChange={vi.fn()}
            onArchive={vi.fn()}
            onBodyChange={vi.fn()}
            onCancelSchedule={vi.fn()}
            onNotifyChange={vi.fn()}
            onPublish={vi.fn()}
            onPublishedAtChange={vi.fn()}
            onSave={vi.fn()}
            onSchedule={vi.fn()}
            onScheduledAtChange={vi.fn()}
            onTitleChange={vi.fn()}
            onUnarchive={vi.fn()}
            onUnpublish={vi.fn()}
            publishedAt=""
            scheduledAt=""
            showNotify={false}
            status="DRAFT"
            title="Beitrag"
        />,
    )
}

describe('PublicationEditorLayout locale', () => {
    it('renders the localized save action in an English session', () => {
        renderWithLocale(
            <PublicationEditorLayout
                accessPolicy="FREE"
                body="<p>Text</p>"
                errorMessage={null}
                isSaving={false}
                kind="article"
                notifySubscribers={false}
                onAccessPolicyChange={vi.fn()}
                onArchive={vi.fn()}
                onBodyChange={vi.fn()}
                onCancelSchedule={vi.fn()}
                onNotifyChange={vi.fn()}
                onPublish={vi.fn()}
                onPublishedAtChange={vi.fn()}
                onSave={vi.fn()}
                onSchedule={vi.fn()}
                onScheduledAtChange={vi.fn()}
                onTitleChange={vi.fn()}
                onUnarchive={vi.fn()}
                onUnpublish={vi.fn()}
                publishedAt=""
                scheduledAt=""
                showNotify={false}
                status="DRAFT"
                title="Post"
            />,
            {lang: 'en'},
        )

        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Speichern'})).not.toBeInTheDocument()
    })
})

describe('PublicationEditorLayout tabs', () => {
    beforeEach(() => {
        renderContentHtml.mockClear()
    })

    it('does not render body HTML while the Write tab is active', () => {
        renderLayout('<p>Draft</p><script>alert(1)</script>')

        expect(renderContentHtml).not.toHaveBeenCalled()
        expect(screen.getByRole('tab', {name: 'Schreiben'})).toHaveAttribute(
            'aria-selected',
            'true',
        )
    })

    it('links tabs and panels and supports arrow-key navigation with wraparound', async () => {
        const user = userEvent.setup()
        renderLayout()

        const writeTab = screen.getByRole('tab', {name: 'Schreiben'})
        const previewTab = screen.getByRole('tab', {name: 'Vorschau'})
        const panels = screen.getAllByRole('tabpanel', {hidden: true})
        const writePanel = panels[0]
        const previewPanel = panels[1]

        expect(writeTab).toHaveAttribute('aria-controls', writePanel.id)
        expect(writePanel).toHaveAttribute('aria-labelledby', writeTab.id)
        expect(previewTab).toHaveAttribute('aria-controls', previewPanel.id)
        expect(previewPanel).toHaveAttribute('aria-labelledby', previewTab.id)
        expect(writeTab).toHaveAttribute('tabindex', '0')
        expect(previewTab).toHaveAttribute('tabindex', '-1')
        expect(writePanel).not.toHaveAttribute('hidden')
        expect(previewPanel).toHaveAttribute('hidden')

        writeTab.focus()
        await user.keyboard('{ArrowRight}')
        expect(previewTab).toHaveFocus()
        expect(previewTab).toHaveAttribute('aria-selected', 'true')
        expect(writePanel).toHaveAttribute('hidden')
        expect(previewPanel).not.toHaveAttribute('hidden')

        await user.keyboard('{ArrowRight}')
        expect(writeTab).toHaveFocus()
        expect(writeTab).toHaveAttribute('aria-selected', 'true')

        await user.keyboard('{ArrowLeft}')
        expect(previewTab).toHaveFocus()
        expect(previewTab).toHaveAttribute('aria-selected', 'true')
    })

    it('renders sanitized draft HTML in the preview', async () => {
        const user = userEvent.setup()
        renderLayout('<p>Safe</p><img src="javascript:alert(1)"><script>alert(2)</script>')

        expect(renderContentHtml).not.toHaveBeenCalled()
        await user.click(screen.getByRole('tab', {name: 'Vorschau'}))
        expect(renderContentHtml).toHaveBeenCalled()
        const previewPanel = screen.getByRole('tabpanel', {name: 'Vorschau'})

        expect(within(previewPanel).getByText('Safe')).toBeInTheDocument()
        expect(previewPanel.innerHTML).not.toContain('javascript:')
        expect(previewPanel.innerHTML).not.toContain('<script')
    })
})
