package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private static final String EMAIL_NOTIFY_MODULE_KEY = "EMAIL_NOTIFY";

    private final TenantMembershipRepository tenantMembershipRepository;
    private final SubscriberNotificationGate subscriberNotificationGate;

    @Transactional(readOnly = true)
    public boolean isEmailNotifyAvailable(Long tenantId) {
        return subscriberNotificationGate.availableForTenant(tenantId);
    }

    @Transactional(readOnly = true)
    public boolean isEmailNotificationsEnabled(Long tenantId, Long userId) {
        return requireMembership(tenantId, userId).isEmailNotificationsEnabled();
    }

    @Transactional
    public TenantMembership updateEmailNotificationsEnabled(
            Long tenantId,
            Long userId,
            boolean emailNotificationsEnabled
    ) {
        if (emailNotificationsEnabled && !subscriberNotificationGate.availableForTenant(tenantId)) {
            throw new ModuleNotEnabledException(EMAIL_NOTIFY_MODULE_KEY);
        }
        TenantMembership membership = requireMembership(tenantId, userId);
        membership.setEmailNotificationsEnabled(emailNotificationsEnabled);
        return tenantMembershipRepository.save(membership);
    }

    private TenantMembership requireMembership(Long tenantId, Long userId) {
        return tenantMembershipRepository.findByUserIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, userId));
    }
}
