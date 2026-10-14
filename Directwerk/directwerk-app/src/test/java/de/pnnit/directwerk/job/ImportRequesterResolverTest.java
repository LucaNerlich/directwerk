package de.pnnit.directwerk.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class ImportRequesterResolverTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final MembershipPermissionService membershipPermissionService =
            mock(MembershipPermissionService.class);
    private final ImportRequesterResolver resolver =
            new ImportRequesterResolver(userRepository, membershipPermissionService);

    @Test
    void resolvesTheRequesterRecordedWhenTheJobWasEnqueued() {
        DirectwerkUserPrincipal expected = requester();
        when(membershipPermissionService.principalForMember(10L, 7L)).thenReturn(Optional.of(expected));

        assertThat(resolver.requireRequester(10L, 7L, "editor@example.com")).isEqualTo(expected);
        verifyNoInteractions(userRepository);
    }

    @Test
    void fallsBackToTheEmailForPayloadsEnqueuedBeforeTheFieldExisted() {
        User user = new User();
        user.setId(7L);
        user.setEmail("editor@example.com");
        DirectwerkUserPrincipal expected = requester();
        when(userRepository.findByEmailIgnoreCase("editor@example.com")).thenReturn(Optional.of(user));
        when(membershipPermissionService.principalForMember(10L, 7L)).thenReturn(Optional.of(expected));

        assertThat(resolver.requireRequester(10L, null, "editor@example.com")).isEqualTo(expected);
    }

    @Test
    void refusesWhenTheRequesterIsNotAMemberOfTheTenant() {
        // #303 fail-closed: better to fail the run up front than to import nothing but report an
        // item-by-item authorization error nobody can act on.
        when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.requireRequester(10L, null, "ghost@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("refusing to import without an identity");
    }

    private static DirectwerkUserPrincipal requester() {
        return new DirectwerkUserPrincipal(
                7L, "editor@example.com", "hash", 10L,
                List.of(new SimpleGrantedAuthority("ROLE_EDITOR")));
    }
}
