package de.pnnit.directwerk.modules.content;

import java.util.ArrayList;
import java.util.List;

/**
 * The single source of truth for which actions are valid in each publication
 * phase. Enforcement guards and the API's {@code availableActions} projection
 * both read this table, so a client can never be offered an action the server
 * rejects for state reasons.
 *
 * <p>Permissions are deliberately not part of this table: RBAC is evaluated per
 * caller (see {@code MembershipPermissionService}) and stays authoritative.</p>
 */
public final class PublicationActions {

    private PublicationActions() {
    }

    /**
     * Actions for episodes and articles. A published item with a working-draft
     * overlay can re-publish that draft or discard it, but cannot be archived
     * until the overlay is resolved.
     */
    public static List<LifecycleAction> forContent(PublicationPhase phase, boolean hasWorkingDraft) {
        return switch (phase) {
            case DRAFT -> List.of(LifecycleAction.EDIT, LifecycleAction.PUBLISH,
                    LifecycleAction.SCHEDULE, LifecycleAction.DELETE);
            case SCHEDULED -> List.of(LifecycleAction.PUBLISH,
                    LifecycleAction.CANCEL_SCHEDULE, LifecycleAction.DELETE);
            case ARCHIVED -> List.of(LifecycleAction.UNARCHIVE, LifecycleAction.DELETE);
            case PUBLISHED -> publishedContentActions(hasWorkingDraft);
        };
    }

    /**
     * Actions for bonus files. They share the phase model but have no schedule
     * and no working-draft overlay; published files must be withdrawn before
     * they can be archived or deleted.
     */
    public static List<LifecycleAction> forDigitalPublication(PublicationPhase phase) {
        return switch (phase) {
            case DRAFT -> List.of(LifecycleAction.EDIT, LifecycleAction.PUBLISH,
                    LifecycleAction.DELETE);
            case PUBLISHED -> List.of(LifecycleAction.UNPUBLISH, LifecycleAction.ARCHIVE);
            case ARCHIVED -> List.of(LifecycleAction.EDIT, LifecycleAction.UNARCHIVE,
                    LifecycleAction.DELETE);
            case SCHEDULED -> throw new IllegalArgumentException(
                    "Digital publications cannot be scheduled");
        };
    }

    /**
     * Actions for a podcast series. Series have no schedule, archive or delete
     * endpoint; publishing requires channel artwork and is validated separately.
     */
    public static List<LifecycleAction> forSeries(PublicationPhase phase) {
        return switch (phase) {
            case DRAFT -> List.of(LifecycleAction.EDIT, LifecycleAction.PUBLISH);
            case PUBLISHED -> List.of(LifecycleAction.EDIT, LifecycleAction.UNPUBLISH);
            case SCHEDULED, ARCHIVED -> throw new IllegalArgumentException(
                    "Series cannot be " + phase);
        };
    }

    private static List<LifecycleAction> publishedContentActions(boolean hasWorkingDraft) {
        List<LifecycleAction> actions = new ArrayList<>(List.of(
                LifecycleAction.EDIT,
                LifecycleAction.UNPUBLISH,
                LifecycleAction.NOTIFY,
                LifecycleAction.DELETE));
        if (hasWorkingDraft) {
            actions.add(LifecycleAction.PUBLISH);
            actions.add(LifecycleAction.DISCARD_DRAFT);
        } else {
            actions.add(LifecycleAction.ARCHIVE);
        }
        return List.copyOf(actions);
    }
}
