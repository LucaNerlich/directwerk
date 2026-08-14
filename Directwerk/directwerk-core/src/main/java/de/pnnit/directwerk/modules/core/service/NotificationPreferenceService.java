package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.service.TenantMembershipNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private final TenantMembershipRepository tenantMembershipRepository;

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
        TenantMembership membership = requireMembership(tenantId, userId);
        membership.setEmailNotificationsEnabled(emailNotificationsEnabled);
        return tenantMembershipRepository.save(membership);
    }

    private TenantMembership requireMembership(Long tenantId, Long userId) {
        return tenantMembershipRepository.findByUserIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new TenantMembershipNotFoundException(tenantId, userId));
    }
}
