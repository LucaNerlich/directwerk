package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantUserQueryService {

    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantRepository tenantRepository;

    @Transactional(readOnly = true)
    public List<TenantUserView> listTenantUsers(Long tenantId) {
        tenantRepository.requireById(tenantId);
        return tenantMembershipRepository.findByTenantId(tenantId).stream()
                .map(this::toView)
                .toList();
    }

    private TenantUserView toView(TenantMembership membership) {
        return new TenantUserView(
                membership.getUser().getId(),
                membership.getUser().getEmail(),
                membership.getUser().getName(),
                membership.getRoles().stream().map(Enum::name).sorted().toList(),
                membership.getStatus().name(),
                membership.getInvitedAt(),
                membership.getLastLoginAt()
        );
    }

    public record TenantUserView(
            Long userId,
            String email,
            String name,
            List<String> roles,
            String status,
            java.time.Instant invitedAt,
            java.time.Instant lastLoginAt
    ) {
    }
}
