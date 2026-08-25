package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkProperties;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PlatformAdminBootstrapTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PlatformAdminRepository platformAdminRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void createsActivePlatformAdminWhenNoneExists() throws Exception {
        DirectwerkProperties.Bootstrap config =
                new DirectwerkProperties.Bootstrap("first-admin@example.com", "secure-password");
        PlatformAdminBootstrap bootstrap =
                new PlatformAdminBootstrap(userRepository, platformAdminRepository, passwordEncoder, config);
        when(platformAdminRepository.count()).thenReturn(0L);
        when(userRepository.findByEmailIgnoreCase("first-admin@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secure-password")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(10L);
            return user;
        });

        bootstrap.run(new DefaultApplicationArguments());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getEmail()).isEqualTo("first-admin@example.com");
        assertThat(userCaptor.getValue().getPasswordHash()).isEqualTo("encoded");
        assertThat(userCaptor.getValue().getStatus()).isEqualTo(UserStatus.ACTIVE);
        ArgumentCaptor<PlatformAdmin> adminCaptor = ArgumentCaptor.forClass(PlatformAdmin.class);
        verify(platformAdminRepository).save(adminCaptor.capture());
        assertThat(adminCaptor.getValue().getUser()).isSameAs(userCaptor.getValue());
    }

    @Test
    void leavesExistingPlatformAdminUntouched() throws Exception {
        DirectwerkProperties.Bootstrap config =
                new DirectwerkProperties.Bootstrap("replacement@example.com", "secure-password");
        PlatformAdminBootstrap bootstrap =
                new PlatformAdminBootstrap(userRepository, platformAdminRepository, passwordEncoder, config);
        when(platformAdminRepository.count()).thenReturn(1L);

        bootstrap.run(new DefaultApplicationArguments());

        verify(userRepository, never()).save(any());
        verify(platformAdminRepository, never()).save(any());
    }

    @Test
    void rejectsPartialBootstrapConfiguration() {
        DirectwerkProperties.Bootstrap config =
                new DirectwerkProperties.Bootstrap("first-admin@example.com", "");
        PlatformAdminBootstrap bootstrap =
                new PlatformAdminBootstrap(userRepository, platformAdminRepository, passwordEncoder, config);

        assertThatThrownBy(() -> bootstrap.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("both email and password");
    }
}
