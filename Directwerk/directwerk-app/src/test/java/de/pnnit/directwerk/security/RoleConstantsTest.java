package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Role;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class RoleConstantsTest {

    @Test
    void everyDomainRoleHasAMatchingSpringSecurityConstant() {
        List<String> expected = Arrays.stream(Role.values())
                .map(role -> "ROLE_" + role.name())
                .toList();

        assertThat(List.of(
                RoleConstants.PLATFORM_ADMIN,
                RoleConstants.TENANT_ADMIN,
                RoleConstants.EDITOR,
                RoleConstants.SUBSCRIBER,
                RoleConstants.GUEST
        )).containsExactlyInAnyOrderElementsOf(expected);
    }
}
