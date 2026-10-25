package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class TenantUserQueryServiceTest {

    private static final Long TENANT_ID = 7L;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private TenantUserQueryService service;

    @Test
    void listTenantUsersPagesAndSearches() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(tenantMembershipRepository.searchByTenantId(
                        eq(TENANT_ID), eq("alex"), eq(false), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(membership(3L, "alex@example.com")), Pageable.ofSize(50), 1));

        TenantUserQueryService.TenantUserPage page =
                service.listTenantUsers(TENANT_ID, 0, 50, " alex ");

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.content()).extracting(TenantUserQueryService.TenantUserView::email)
                .containsExactly("alex@example.com");

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(tenantMembershipRepository).searchByTenantId(
                eq(TENANT_ID), eq("alex"), eq(false), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(50);
        assertThat(pageable.getValue().getSort().getOrderFor("user.id")).isNotNull();
    }

    @Test
    void listTenantUsersClampsSizeAndTreatsBlankQueryAsUnfiltered() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(tenantMembershipRepository.searchByTenantId(
                        eq(TENANT_ID), eq(""), eq(true), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(100), 0));

        TenantUserQueryService.TenantUserPage page =
                service.listTenantUsers(TENANT_ID, -1, 500, "   ");

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(tenantMembershipRepository).searchByTenantId(
                eq(TENANT_ID), eq(""), eq(true), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(100);
    }

    private static TenantMembership membership(Long userId, String email) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);

        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        user.setName("Alex");

        TenantMembership membership = new TenantMembership();
        membership.setTenant(tenant);
        membership.setUser(user);
        membership.setRoles(EnumSet.of(Role.EDITOR));
        membership.setStatus(MembershipStatus.ACTIVE);
        return membership;
    }
}
