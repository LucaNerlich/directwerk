package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MembershipPermissionServiceTest {

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantRepository tenantRepository;

    private MembershipPermissionService service;

    @BeforeEach
    void setUp() {
        service = new MembershipPermissionService(
                overrideRepository, tenantMembershipRepository, tenantRepository,
                platformAuditService);
        lenient().when(overrideRepository.save(any(MembershipPermissionOverride.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void replaceForUserPersistsDistinctValidatedRows() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        TenantMembership membership = membership(7L, tenant, EnumSet.of(Role.EDITOR));
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(tenantMembershipRepository.findByTenantIdAndUserId(10L, 5L))
                .thenReturn(Optional.of(membership));

        List<MembershipPermissionOverride> saved = service.replaceForUser(10L, 5L, List.of(
                new MembershipPermissionService.OverrideInput(
                        ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.DENY),
                new MembershipPermissionService.OverrideInput(
                        ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.DENY),
                new MembershipPermissionService.OverrideInput(
                        ContentEntityType.ARTICLE, ContentOperation.DELETE, RestrictionScope.OTHERS_ONLY)));

        assertThat(saved).hasSize(2);
        verify(overrideRepository).deleteByTenantIdAndMembershipId(10L, 7L);
        verify(platformAuditService).record(
                eq(PlatformAuditActions.MEMBER_RESTRICTIONS_CHANGED),
                eq(10L),
                any(Map.class));
    }

    @Test
    void replaceForUserWithEmptyInputLiftsAllRestrictions() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(tenantMembershipRepository.findByTenantIdAndUserId(10L, 5L))
                .thenReturn(Optional.of(membership(7L, tenant, EnumSet.of(Role.EDITOR))));

        assertThat(service.replaceForUser(10L, 5L, List.of())).isEmpty();
        verify(overrideRepository).deleteByTenantIdAndMembershipId(10L, 7L);
    }

    @Test
    void replaceForUserRejectsUnknownMembership() {
        when(tenantRepository.requireById(10L)).thenReturn(new Tenant());
        when(tenantMembershipRepository.findByTenantIdAndUserId(10L, 99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.replaceForUser(10L, 99L, List.of()))
                .isInstanceOf(TenantMembershipNotFoundException.class);
    }

    @Test
    void replaceForUserRejectsTenantAdminTargets() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(tenantMembershipRepository.findByTenantIdAndUserId(10L, 5L))
                .thenReturn(Optional.of(membership(7L, tenant, EnumSet.of(Role.TENANT_ADMIN))));

        assertThatThrownBy(() -> service.replaceForUser(10L, 5L, List.of(
                        new MembershipPermissionService.OverrideInput(
                                ContentEntityType.EPISODE, ContentOperation.DELETE, RestrictionScope.DENY))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("EDITOR");
    }

    @Test
    void replaceForUserRejectsUnreadableAndOwnOnlyMisuse() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(tenantMembershipRepository.findByTenantIdAndUserId(10L, 5L))
                .thenReturn(Optional.of(membership(7L, tenant, EnumSet.of(Role.EDITOR))));

        assertThatThrownBy(() -> service.replaceForUser(10L, 5L, List.of(
                        new MembershipPermissionService.OverrideInput(
                                ContentEntityType.EPISODE, ContentOperation.READ, RestrictionScope.DENY))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("READ");

        assertThatThrownBy(() -> service.replaceForUser(10L, 5L, List.of(
                        new MembershipPermissionService.OverrideInput(
                                ContentEntityType.EPISODE, ContentOperation.CREATE, RestrictionScope.OTHERS_ONLY))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CREATE");
    }

    private static TenantMembership membership(Long id, Tenant tenant, EnumSet<Role> roles) {
        TenantMembership membership = new TenantMembership();
        membership.setId(id);
        membership.setTenant(tenant);
        membership.setRoles(roles);
        return membership;
    }
}
