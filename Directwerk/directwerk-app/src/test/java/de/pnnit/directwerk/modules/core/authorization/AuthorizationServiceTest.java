package de.pnnit.directwerk.modules.core.authorization;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class AuthorizationServiceTest {

    private static final Long TENANT = 10L;
    private static final Long ME = 1L;
    private static final Long STRANGER = 2L;

    @Test
    void tenantAdminIsAlwaysAllowed() {
        DirectwerkUserPrincipal admin = principal(ME, Role.TENANT_ADMIN);
        Set<MembershipPermissionOverride> overrides = Set.of(
                override(ContentEntityType.EPISODE, ContentOperation.DELETE, RestrictionScope.DENY));

        for (ContentEntityType entity : ContentEntityType.values()) {
            for (ContentOperation operation : ContentOperation.values()) {
                AuthorizationService.requireContentAccess(admin, entity, operation, STRANGER, overrides);
            }
        }
    }

    @Test
    void platformAdminIsAlwaysAllowed() {
        DirectwerkUserPrincipal admin = new DirectwerkUserPrincipal(
                ME, "root@example.com", "hash", null, List.of(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN")));

        AuthorizationService.requireContentAccess(
                admin, ContentEntityType.EPISODE, ContentOperation.DELETE, STRANGER, Set.of());
    }

    @Test
    void editorBaselineAllowsEverythingWithoutOverrides() {
        DirectwerkUserPrincipal editor = principal(ME, Role.EDITOR);

        for (ContentEntityType entity : ContentEntityType.values()) {
            for (ContentOperation operation : ContentOperation.values()) {
                AuthorizationService.requireContentAccess(
                        editor, entity, operation, STRANGER, AuthorizationService.noOverrides());
            }
        }
    }

    @Test
    void subscriberIsDeniedFailClosed() {
        DirectwerkUserPrincipal subscriber = principal(ME, Role.SUBSCRIBER);

        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        subscriber, ContentEntityType.EPISODE, ContentOperation.READ, null, Set.of()))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY);
    }

    @Test
    void nullPrincipalIsDenied() {
        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        null, ContentEntityType.EPISODE, ContentOperation.READ, null, Set.of()))
                .isInstanceOf(ContentAccessDeniedException.class);
    }

    @Test
    void denyOverrideRefusesOwnAndForeignContent() {
        DirectwerkUserPrincipal editor = principal(ME, Role.EDITOR);
        Set<MembershipPermissionOverride> overrides = Set.of(
                override(ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.DENY));

        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        editor, ContentEntityType.EPISODE, ContentOperation.PUBLISH, ME, overrides))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.OPERATION_DENIED_BY_POLICY);
        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        editor, ContentEntityType.EPISODE, ContentOperation.PUBLISH, STRANGER, overrides))
                .isInstanceOf(ContentAccessDeniedException.class);

        // Other operations and entities stay allowed.
        AuthorizationService.requireContentAccess(
                editor, ContentEntityType.EPISODE, ContentOperation.UPDATE, STRANGER, overrides);
        AuthorizationService.requireContentAccess(
                editor, ContentEntityType.ARTICLE, ContentOperation.PUBLISH, STRANGER, overrides);
    }

    @Test
    void ownOnlyOverrideAllowsOwnRefusesForeignAndLegacy() {
        DirectwerkUserPrincipal editor = principal(ME, Role.EDITOR);
        Set<MembershipPermissionOverride> overrides = Set.of(
                override(ContentEntityType.ARTICLE, ContentOperation.DELETE, RestrictionScope.OTHERS_ONLY));

        AuthorizationService.requireContentAccess(
                editor, ContentEntityType.ARTICLE, ContentOperation.DELETE, ME, overrides);
        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        editor, ContentEntityType.ARTICLE, ContentOperation.DELETE, STRANGER, overrides))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
        assertThatThrownBy(() -> AuthorizationService.requireContentAccess(
                        editor, ContentEntityType.ARTICLE, ContentOperation.DELETE, null, overrides))
                .isInstanceOf(ContentAccessDeniedException.class);
    }

    @Test
    void effectiveRightsReflectRolesAndOverrides() {
        DirectwerkUserPrincipal admin = principal(ME, Role.TENANT_ADMIN);
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> adminRights =
                AuthorizationService.effectiveRights(admin, Set.of());
        assertThat(adminRights.get(ContentEntityType.EPISODE).get(ContentOperation.DELETE))
                .isEqualTo(EffectiveAccess.FULL);

        DirectwerkUserPrincipal editor = principal(ME, Role.EDITOR);
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> baseline =
                AuthorizationService.effectiveRights(editor, Set.of());
        assertThat(baseline.get(ContentEntityType.MEDIA_ASSET).get(ContentOperation.MOVE))
                .isEqualTo(EffectiveAccess.FULL);

        Set<MembershipPermissionOverride> overrides = new HashSet<>();
        overrides.add(override(ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.DENY));
        overrides.add(override(ContentEntityType.EPISODE, ContentOperation.DELETE, RestrictionScope.OTHERS_ONLY));
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> restricted =
                AuthorizationService.effectiveRights(editor, overrides);
        assertThat(restricted.get(ContentEntityType.EPISODE).get(ContentOperation.PUBLISH))
                .isEqualTo(EffectiveAccess.DENIED);
        assertThat(restricted.get(ContentEntityType.EPISODE).get(ContentOperation.DELETE))
                .isEqualTo(EffectiveAccess.OWN_ONLY);
        assertThat(restricted.get(ContentEntityType.EPISODE).get(ContentOperation.UPDATE))
                .isEqualTo(EffectiveAccess.FULL);
        assertThat(restricted.get(ContentEntityType.ARTICLE).get(ContentOperation.DELETE))
                .isEqualTo(EffectiveAccess.FULL);
    }

    @Test
    void subscriberSeesDeniedEverywhere() {
        DirectwerkUserPrincipal subscriber = principal(ME, Role.SUBSCRIBER);
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> rights =
                AuthorizationService.effectiveRights(subscriber, Set.of());
        assertThat(rights.get(ContentEntityType.EPISODE).get(ContentOperation.READ))
                .isEqualTo(EffectiveAccess.DENIED);
    }

    private static DirectwerkUserPrincipal principal(Long userId, Role role) {
        String authority = switch (role) {
            case PLATFORM_ADMIN -> RoleConstants.PLATFORM_ADMIN;
            case TENANT_ADMIN -> RoleConstants.TENANT_ADMIN;
            case EDITOR -> RoleConstants.EDITOR;
            case SUBSCRIBER -> RoleConstants.SUBSCRIBER;
            case GUEST -> RoleConstants.GUEST;
        };
        return new DirectwerkUserPrincipal(
                userId, "user@example.com", "hash", TENANT, List.of(new SimpleGrantedAuthority(authority)));
    }

}
