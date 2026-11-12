package de.pnnit.directwerk.modules.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PublicationActionsTest {

    @Test
    void draftCanBeEditedPublishedScheduledOrDeleted() {
        assertThat(PublicationActions.forContent(PublicationPhase.DRAFT, false))
                .containsExactly(
                        LifecycleAction.EDIT,
                        LifecycleAction.PUBLISH,
                        LifecycleAction.SCHEDULE,
                        LifecycleAction.DELETE);
    }

    @Test
    void scheduledCanBePublishedNowCancelledOrDeleted() {
        assertThat(PublicationActions.forContent(PublicationPhase.SCHEDULED, false))
                .containsExactly(
                        LifecycleAction.PUBLISH,
                        LifecycleAction.CANCEL_SCHEDULE,
                        LifecycleAction.DELETE);
    }

    @Test
    void publishedWithoutWorkingDraftCanBeArchivedButNotRepublished() {
        assertThat(PublicationActions.forContent(PublicationPhase.PUBLISHED, false))
                .contains(LifecycleAction.ARCHIVE, LifecycleAction.UNPUBLISH, LifecycleAction.NOTIFY)
                .doesNotContain(LifecycleAction.PUBLISH, LifecycleAction.DISCARD_DRAFT);
    }

    @Test
    void publishedWithWorkingDraftCanRepublishOrDiscardButNotArchive() {
        assertThat(PublicationActions.forContent(PublicationPhase.PUBLISHED, true))
                .contains(LifecycleAction.PUBLISH, LifecycleAction.DISCARD_DRAFT)
                .doesNotContain(LifecycleAction.ARCHIVE);
    }

    @Test
    void archivedCanOnlyBeRestoredOrDeleted() {
        assertThat(PublicationActions.forContent(PublicationPhase.ARCHIVED, false))
                .containsExactly(LifecycleAction.UNARCHIVE, LifecycleAction.DELETE);
    }

    @Test
    void everyPhaseHasAtLeastOneActionAndNoDuplicates() {
        for (PublicationPhase phase : PublicationPhase.values()) {
            assertThat(PublicationActions.forContent(phase, false))
                    .as("actions for %s", phase)
                    .isNotEmpty()
                    .doesNotHaveDuplicates();
        }
    }

    @Test
    void digitalPublicationsCannotBeScheduled() {
        assertThatThrownBy(() -> PublicationActions.forDigitalPublication(PublicationPhase.SCHEDULED))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void publishedDigitalPublicationMustBeWithdrawnBeforeArchiveOrDelete() {
        assertThat(PublicationActions.forDigitalPublication(PublicationPhase.PUBLISHED))
                .containsExactly(LifecycleAction.UNPUBLISH, LifecycleAction.ARCHIVE)
                .doesNotContain(LifecycleAction.EDIT, LifecycleAction.DELETE);
    }

    @Test
    void seriesDraftCanBeEditedOrPublished() {
        assertThat(PublicationActions.forSeries(PublicationPhase.DRAFT))
                .containsExactly(LifecycleAction.EDIT, LifecycleAction.PUBLISH);
    }

    @Test
    void seriesPublishedCanBeEditedOrWithdrawn() {
        assertThat(PublicationActions.forSeries(PublicationPhase.PUBLISHED))
                .containsExactly(LifecycleAction.EDIT, LifecycleAction.UNPUBLISH);
    }

    @Test
    void archivedDigitalPublicationStaysEditableUntilRestored() {
        assertThat(PublicationActions.forDigitalPublication(PublicationPhase.ARCHIVED))
                .containsExactly(
                        LifecycleAction.EDIT,
                        LifecycleAction.UNARCHIVE,
                        LifecycleAction.DELETE);
    }
}
