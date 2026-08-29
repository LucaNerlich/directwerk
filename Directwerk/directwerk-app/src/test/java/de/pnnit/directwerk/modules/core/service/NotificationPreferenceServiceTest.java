package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationPreferenceServiceTest {

    private static final Long TENANT_ID = 1L;
    private static final Long USER_ID = 9L;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private SubscriberNotificationGate subscriberNotificationGate;

    @InjectMocks
    private NotificationPreferenceService service;

    @Test
    void rejectsOptInWhenEmailNotifyUnavailable() {
        when(subscriberNotificationGate.availableForTenant(TENANT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.updateEmailNotificationsEnabled(TENANT_ID, USER_ID, true))
                .isInstanceOf(ModuleNotEnabledException.class)
                .hasMessageContaining("EMAIL_NOTIFY");
    }

    @Test
    void allowsOptOutWhenEmailNotifyUnavailable() {
        TenantMembership membership = new TenantMembership();
        membership.setEmailNotificationsEnabled(true);
        when(tenantMembershipRepository.findByUserIdAndTenantId(USER_ID, TENANT_ID))
                .thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantMembership updated = service.updateEmailNotificationsEnabled(TENANT_ID, USER_ID, false);

        assertThat(updated.isEmailNotificationsEnabled()).isFalse();
        verify(tenantMembershipRepository).save(membership);
    }

    @Test
    void allowsOptInWhenEmailNotifyAvailable() {
        TenantMembership membership = new TenantMembership();
        membership.setEmailNotificationsEnabled(false);
        when(subscriberNotificationGate.availableForTenant(TENANT_ID)).thenReturn(true);
        when(tenantMembershipRepository.findByUserIdAndTenantId(USER_ID, TENANT_ID))
                .thenReturn(Optional.of(membership));
        when(tenantMembershipRepository.save(membership)).thenReturn(membership);

        TenantMembership updated = service.updateEmailNotificationsEnabled(TENANT_ID, USER_ID, true);

        assertThat(updated.isEmailNotificationsEnabled()).isTrue();
    }
}
