'use client'

import {Card, CardContent} from '@directwerk/ui/components/card'
import SectionHeader from '@directwerk/ui/components/section-header'

import CoverImageField from '@/components/publication/content-editor/CoverImageField'
import FormatCategoryPicker from '@/components/publication/FormatCategoryPicker'
import NewsletterListPicker from '@/components/write/NewsletterListPicker'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import type {CategorySummary, NewsletterListSummary} from '@directwerk/api/types'

/** Article-only sidebar fields: hero image, categories, newsletter lists. */
export default function ArticleEditorSidebar({
    title,
    heroAssetId,
    heroPreviewUrl,
    busy,
    readOnly,
    isSaving,
    isHeroUploading,
    heroUploadProgress,
    showNotify,
    notifySubscribers,
    availableCategories,
    selectedCategoryIds,
    availableNewsletterLists,
    selectedNewsletterListIds,
    showClassification,
    onAuthRequired,
    onHeroUpload,
    onHeroSelect,
    onHeroClear,
    onCategoryChange,
    onNewsletterChange,
}: {
    title: string
    heroAssetId: number | null
    heroPreviewUrl: string | null
    busy: boolean
    readOnly: boolean
    isSaving: boolean
    isHeroUploading: boolean
    heroUploadProgress: {file: File; progress: number} | null
    showNotify: boolean
    notifySubscribers: boolean
    availableCategories: CategorySummary[]
    selectedCategoryIds: Set<number>
    availableNewsletterLists: NewsletterListSummary[]
    selectedNewsletterListIds: Set<number>
    showClassification: boolean
    onAuthRequired: () => void
    onHeroUpload: (file: File | null) => Promise<void>
    onHeroSelect: (assetId: number) => void
    onHeroClear: () => void
    onCategoryChange: (ids: Set<number>) => void
    onNewsletterChange: (ids: Set<number>) => void
}): React.JSX.Element {
    const dict = useDictionary()
    const coverDisabled = isSaving || isHeroUploading || readOnly

    return (
        <>
            <CoverImageField
                title="Titelbild"
                description={dict.write.coverImageHint}
                previewUrl={heroPreviewUrl}
                previewAlt={
                    title.trim().length > 0 ? `Titelbild: ${title}` : 'Titelbild'
                }
                assetId={heroAssetId}
                disabled={coverDisabled}
                showLibraryPicker
                libraryLabel={dict.podcast.titelbildMediathek}
                uploadLabel="Bild hochladen"
                replaceLabel="Bild ersetzen"
                onAuthRequired={onAuthRequired}
                onUpload={onHeroUpload}
                onSelectFromLibrary={onHeroSelect}
                onClear={onHeroClear}
                uploadProgress={heroUploadProgress}
            />
            {showClassification ? (
                <Card>
                    <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                        <SectionHeader
                            as="h3"
                            description={dict.write.categoriesStructureSiteFeeds}
                            title="Einordnung"
                        />
                        <FormatCategoryPicker
                            categories={availableCategories}
                            disabled={busy || readOnly}
                            onCategoryChange={onCategoryChange}
                            selectedCategoryIds={selectedCategoryIds}
                            selectedFormatIds={new Set()}
                        />
                    </CardContent>
                </Card>
            ) : null}
            {showNotify ? (
                <Card>
                    <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
                        <SectionHeader
                            as="h3"
                            description={dict.write.attachedListsNotifyOnPublish}
                            title="Newsletter"
                        />
                        <NewsletterListPicker
                            disabled={busy || readOnly}
                            lists={availableNewsletterLists}
                            onChange={onNewsletterChange}
                            selectedListIds={selectedNewsletterListIds}
                            warnMissingAttachment={
                                notifySubscribers &&
                                selectedNewsletterListIds.size === 0
                            }
                        />
                    </CardContent>
                </Card>
            ) : null}
        </>
    )
}
