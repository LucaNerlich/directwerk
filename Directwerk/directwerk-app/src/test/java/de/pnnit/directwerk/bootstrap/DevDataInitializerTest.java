package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class DevDataInitializerTest {

    private static final DirectwerkProperties DEV_PROPERTIES = new DirectwerkProperties(
            null,
            new DirectwerkProperties.Dev(
                    "tenant-seed-password",
                    "custom-platform-admin@directwerk.local",
                    "platform-admin-password"
            ),
            null,
            null,
            null,
            null,
            null,
            null
    );

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private PlatformAdminRepository platformAdminRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private DirectwerkConfig directwerkConfig;
    private DevDataInitializer initializer;

    @BeforeEach
    void setUp() {
        directwerkConfig = new DirectwerkConfig(DEV_PROPERTIES);
        initializer = new DevDataInitializer(
                userRepository,
                tenantRepository,
                tenantMembershipRepository,
                platformAdminRepository,
                passwordEncoder,
                directwerkConfig
        );
        stubTenantLookups();
    }

    @Test
    void seedsPlatformAdminWithDedicatedEmailAndPassword() throws Exception {
        stubExistingTenantUsersWithPasswords();
        when(userRepository.findByEmailIgnoreCase("custom-platform-admin@directwerk.local"))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            if (user.getId() == null) {
                user.setId(1L);
            }
            return user;
        });
        when(passwordEncoder.encode("platform-admin-password")).thenReturn("encoded-platform-password");
        when(platformAdminRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(platformAdminRepository.save(any(PlatformAdmin.class))).thenAnswer(invocation -> invocation.getArgument(0));

        initializer.run(new DefaultApplicationArguments());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(userCaptor.capture());
        User savedPlatformAdmin = userCaptor.getAllValues().stream()
                .filter(user -> "custom-platform-admin@directwerk.local".equals(user.getEmail()))
                .findFirst()
                .orElseThrow();
        assertThat(savedPlatformAdmin.getPasswordHash()).isEqualTo("encoded-platform-password");
        assertThat(savedPlatformAdmin.getStatus()).isEqualTo(UserStatus.ACTIVE);
        verify(passwordEncoder).encode("platform-admin-password");
        verify(passwordEncoder, never()).encode("tenant-seed-password");
        verify(platformAdminRepository).save(any(PlatformAdmin.class));
    }

    @Test
    void seedsTenantUsersWithSharedSeedPassword() throws Exception {
        User platformAdminUser = existingUser(1L, "custom-platform-admin@directwerk.local", "existing-platform-hash");
        when(userRepository.findByEmailIgnoreCase("custom-platform-admin@directwerk.local"))
                .thenReturn(Optional.of(platformAdminUser));
        when(platformAdminRepository.findByUserId(1L)).thenReturn(Optional.of(new PlatformAdmin()));
        when(userRepository.findByEmailIgnoreCase("admin-a@alpha-show.local")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("admin-b@alpha-show.local")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("editor@alpha-show.local")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            if (user.getId() == null) {
                user.setId(99L);
            }
            return user;
        });
        when(passwordEncoder.encode("tenant-seed-password")).thenReturn("encoded-tenant-password");

        initializer.run(new DefaultApplicationArguments());

        verify(passwordEncoder, atLeastOnce()).encode("tenant-seed-password");
        verify(passwordEncoder, never()).encode("platform-admin-password");
    }

    @Test
    void doesNotOverwriteExistingPasswordHash() throws Exception {
        stubExistingTenantUsersWithPasswords();
        User platformAdminUser = existingUser(
                1L,
                "custom-platform-admin@directwerk.local",
                "existing-hash"
        );
        when(userRepository.findByEmailIgnoreCase("custom-platform-admin@directwerk.local"))
                .thenReturn(Optional.of(platformAdminUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(platformAdminRepository.findByUserId(1L)).thenReturn(Optional.of(new PlatformAdmin()));

        initializer.run(new DefaultApplicationArguments());

        assertThat(platformAdminUser.getPasswordHash()).isEqualTo("existing-hash");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void skipsPasswordWhenConfiguredPasswordIsBlank() throws Exception {
        stubExistingTenantUsersWithPasswords();
        DirectwerkConfig blankPasswordConfig = new DirectwerkConfig(new DirectwerkProperties(
                null,
                new DirectwerkProperties.Dev("tenant-seed-password", "custom-platform-admin@directwerk.local", "  "),
                null,
                null,
                null,
                null,
                null,
                null
        ));
        DevDataInitializer blankInitializer = new DevDataInitializer(
                userRepository,
                tenantRepository,
                tenantMembershipRepository,
                platformAdminRepository,
                passwordEncoder,
                blankPasswordConfig
        );
        User platformAdminUser = existingUser(1L, "custom-platform-admin@directwerk.local", null);
        when(userRepository.findByEmailIgnoreCase("custom-platform-admin@directwerk.local"))
                .thenReturn(Optional.of(platformAdminUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(platformAdminRepository.findByUserId(1L)).thenReturn(Optional.of(new PlatformAdmin()));

        blankInitializer.run(new DefaultApplicationArguments());

        assertThat(platformAdminUser.getPasswordHash()).isNull();
        verify(passwordEncoder, never()).encode(any());
    }

    private static User existingUser(long id, String email, String passwordHash) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        return user;
    }

    private void stubExistingTenantUsersWithPasswords() {
        when(userRepository.findByEmailIgnoreCase("admin-a@alpha-show.local"))
                .thenReturn(Optional.of(existingUser(2L, "admin-a@alpha-show.local", "tenant-hash")));
        when(userRepository.findByEmailIgnoreCase("admin-b@alpha-show.local"))
                .thenReturn(Optional.of(existingUser(3L, "admin-b@alpha-show.local", "tenant-hash")));
        when(userRepository.findByEmailIgnoreCase("editor@alpha-show.local"))
                .thenReturn(Optional.of(existingUser(4L, "editor@alpha-show.local", "tenant-hash")));
    }

    private void stubTenantLookups() {
        Tenant tenantA = new Tenant();
        tenantA.setId(10L);
        tenantA.setSlug("alpha-show-a");
        Tenant tenantB = new Tenant();
        tenantB.setId(20L);
        tenantB.setSlug("alpha-show-b");
        when(tenantRepository.findBySlug("alpha-show-a")).thenReturn(Optional.of(tenantA));
        when(tenantRepository.findBySlug("alpha-show-b")).thenReturn(Optional.of(tenantB));
        when(tenantMembershipRepository.findByUserIdAndTenantId(anyLong(), anyLong()))
                .thenReturn(Optional.empty());
        when(tenantMembershipRepository.save(any(TenantMembership.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }
}
