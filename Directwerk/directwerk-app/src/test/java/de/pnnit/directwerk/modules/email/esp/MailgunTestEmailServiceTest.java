package de.pnnit.directwerk.modules.email.esp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import java.lang.reflect.Method;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class MailgunTestEmailServiceTest {

    private static final Long TENANT_ID = 10L;

    private static final TenantEspConnectionService.ResolvedEspCredentials CREDENTIALS =
            new TenantEspConnectionService.ResolvedEspCredentials(
                    EspProvider.MAILGUN,
                    "mg.example.com",
                    "hello@example.com",
                    "Beispiel",
                    "EU",
                    "key-secret"
            );

    @Mock
    private DirectwerkConfig directwerkConfig;
    @Mock
    private TenantEspConnectionService tenantEspConnectionService;
    @Mock
    private TenantMembershipRepository tenantMembershipRepository;
    @Mock
    private EmailJobProducer emailJobProducer;

    private MailgunTestEmailService service;

    @BeforeEach
    void setUp() {
        service = new MailgunTestEmailService(
                directwerkConfig,
                tenantEspConnectionService,
                tenantMembershipRepository,
                emailJobProducer
        );
        lenient().when(directwerkConfig.isEmailEnabled()).thenReturn(true);
    }

    @Test
    void sendTestToTenantAdminsMustNotBeTransactional() throws NoSuchMethodException {
        // Outer TX would join QueueService.enqueue (REQUIRED) and break durable inserts /
        // per-recipient catch-and-continue. Keep this method non-transactional.
        Method method = MailgunTestEmailService.class.getMethod("sendTestToTenantAdmins", Long.class);
        assertThat(method.getAnnotation(Transactional.class)).isNull();
        assertThat(MailgunTestEmailService.class.getAnnotation(Transactional.class)).isNull();
    }

    @Test
    void failsWhenMailgunNotConfigured() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.sendTestToTenantAdmins(TENANT_ID))
                .isInstanceOf(MailgunNotConfiguredException.class)
                .extracting(ex -> ((MailgunNotConfiguredException) ex).getCode())
                .isEqualTo("MAILGUN_NOT_CONFIGURED");

        verify(emailJobProducer, never()).enqueueContentNotification(anyLong(), any(), any(), any(), any());
    }

    @Test
    void failsWhenEmailDeliveryDisabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.sendTestToTenantAdmins(TENANT_ID))
                .isInstanceOf(MailgunNotConfiguredException.class)
                .extracting(ex -> ((MailgunNotConfiguredException) ex).getCode())
                .isEqualTo("MAILGUN_NOT_CONFIGURED");

        verify(emailJobProducer, never()).enqueueContentNotification(anyLong(), any(), any(), any(), any());
    }

    @Test
    void failsWhenNoActiveTenantAdmins() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "editor@example.com", "Ed", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.EDITOR),
                membership(2L, "inactive-admin@example.com", "Inactive", UserStatus.ACTIVE, MembershipStatus.DISABLED, Role.TENANT_ADMIN),
                membership(3L, "disabled-user@example.com", "Disabled", UserStatus.DISABLED, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));

        assertThatThrownBy(() -> service.sendTestToTenantAdmins(TENANT_ID))
                .isInstanceOf(NoTenantAdminsException.class)
                .extracting(ex -> ((NoTenantAdminsException) ex).getCode())
                .isEqualTo("NO_TENANT_ADMINS");

        verify(emailJobProducer, never()).enqueueContentNotification(anyLong(), any(), any(), any(), any());
    }

    @Test
    void enqueuesOneJobPerActiveTenantAdmin() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "admin-b@example.com", "B Admin", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "admin-a@example.com", "A Admin", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(3L, "editor@example.com", "Editor", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.EDITOR)
        ));

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.queuedCount()).isEqualTo(2);
        assertThat(result.failedCount()).isZero();
        assertThat(result.results()).extracting(MailgunTestEmailService.RecipientResult::email)
                .containsExactly("admin-a@example.com", "admin-b@example.com");
        assertThat(result.results()).allMatch(r -> "QUEUED".equals(r.status()));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> variablesCaptor = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer, times(2)).enqueueContentNotification(
                eq(TENANT_ID),
                any(),
                eq(EmailTemplate.MAILGUN_CONNECTION_TEST),
                variablesCaptor.capture(),
                isNull()
        );
        assertThat(variablesCaptor.getAllValues())
                .extracting(map -> map.get("recipientName"))
                .containsExactly("A Admin", "B Admin");
    }

    @Test
    void reportsPerRecipientEnqueueFailuresWithoutAbortingOthers() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "ok@example.com", "Ok", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "bad@example.com", "Bad", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));
        doThrow(new IllegalStateException("queue unavailable"))
                .when(emailJobProducer)
                .enqueueContentNotification(
                        eq(TENANT_ID),
                        eq("bad@example.com"),
                        eq(EmailTemplate.MAILGUN_CONNECTION_TEST),
                        any(),
                        isNull()
                );

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.queuedCount()).isEqualTo(1);
        assertThat(result.failedCount()).isEqualTo(1);
        assertThat(result.results()).satisfiesExactly(
                bad -> {
                    assertThat(bad.email()).isEqualTo("bad@example.com");
                    assertThat(bad.status()).isEqualTo("FAILED");
                    assertThat(bad.error()).contains("queue unavailable");
                },
                ok -> {
                    assertThat(ok.email()).isEqualTo("ok@example.com");
                    assertThat(ok.status()).isEqualTo("QUEUED");
                    assertThat(ok.error()).isNull();
                }
        );
    }

    @Test
    void dedupesDuplicateAdminEmails() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "Admin@Example.com", "One", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "admin@example.com", "Two", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.queuedCount()).isEqualTo(1);
        verify(emailJobProducer, times(1)).enqueueContentNotification(
                eq(TENANT_ID),
                eq("admin@example.com"),
                eq(EmailTemplate.MAILGUN_CONNECTION_TEST),
                any(),
                isNull()
        );
    }

    private static TenantMembership membership(
            Long userId,
            String email,
            String name,
            UserStatus userStatus,
            MembershipStatus membershipStatus,
            Role role
    ) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        user.setName(name);
        user.setStatus(userStatus);

        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setTenantId(TENANT_ID);
        membership.setStatus(membershipStatus);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }
}
