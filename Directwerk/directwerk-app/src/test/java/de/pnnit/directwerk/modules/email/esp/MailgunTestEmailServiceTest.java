package de.pnnit.directwerk.modules.email.esp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
    private TenantEspConnectionService tenantEspConnectionService;
    @Mock
    private TenantMembershipRepository tenantMembershipRepository;
    @Mock
    private MailgunHttpEmailSender mailgunHttpEmailSender;

    private MailgunTestEmailService service;

    @BeforeEach
    void setUp() {
        service = new MailgunTestEmailService(
                tenantEspConnectionService,
                tenantMembershipRepository,
                mailgunHttpEmailSender
        );
    }

    @Test
    void failsWhenMailgunNotConfigured() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.sendTestToTenantAdmins(TENANT_ID))
                .isInstanceOf(MailgunNotConfiguredException.class)
                .extracting(ex -> ((MailgunNotConfiguredException) ex).getCode())
                .isEqualTo("MAILGUN_NOT_CONFIGURED");

        verify(mailgunHttpEmailSender, never()).send(any(), any());
    }

    @Test
    void failsWhenNoActiveTenantAdmins() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "editor@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.EDITOR),
                membership(2L, "inactive-admin@example.com", UserStatus.ACTIVE, MembershipStatus.DISABLED, Role.TENANT_ADMIN),
                membership(3L, "disabled-user@example.com", UserStatus.DISABLED, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));

        assertThatThrownBy(() -> service.sendTestToTenantAdmins(TENANT_ID))
                .isInstanceOf(NoTenantAdminsException.class)
                .extracting(ex -> ((NoTenantAdminsException) ex).getCode())
                .isEqualTo("NO_TENANT_ADMINS");

        verify(mailgunHttpEmailSender, never()).send(any(), any());
    }

    @Test
    void sendsOneMessagePerActiveTenantAdmin() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "admin-b@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "admin-a@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(3L, "editor@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.EDITOR)
        ));

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.sentCount()).isEqualTo(2);
        assertThat(result.failedCount()).isZero();
        assertThat(result.results()).extracting(MailgunTestEmailService.RecipientResult::email)
                .containsExactly("admin-a@example.com", "admin-b@example.com");
        assertThat(result.results()).allMatch(r -> "SENT".equals(r.status()));

        ArgumentCaptor<OutboundEmail> emailCaptor = ArgumentCaptor.forClass(OutboundEmail.class);
        verify(mailgunHttpEmailSender, times(2)).send(eq(CREDENTIALS), emailCaptor.capture());
        assertThat(emailCaptor.getAllValues())
                .extracting(OutboundEmail::to)
                .containsExactly("admin-a@example.com", "admin-b@example.com");
        assertThat(emailCaptor.getAllValues()).allSatisfy(email -> {
            assertThat(email.subject()).contains("[TEST]");
            assertThat(email.plainTextBody()).containsIgnoringCase("test");
            assertThat(email.fromAddress()).isEqualTo("hello@example.com");
            assertThat(email.template()).isEqualTo("MAILGUN_TEST");
        });
    }

    @Test
    void reportsPerRecipientFailuresWithoutAbortingOthers() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "ok@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "bad@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));
        doThrow(new EmailDeliveryException("Mailgun rejected the message (HTTP 401)"))
                .when(mailgunHttpEmailSender)
                .send(eq(CREDENTIALS), org.mockito.ArgumentMatchers.argThat(email ->
                        email != null && "bad@example.com".equals(email.to())));

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.sentCount()).isEqualTo(1);
        assertThat(result.failedCount()).isEqualTo(1);
        assertThat(result.results()).satisfiesExactly(
                ok -> {
                    assertThat(ok.email()).isEqualTo("bad@example.com");
                    assertThat(ok.status()).isEqualTo("FAILED");
                    assertThat(ok.error()).contains("401");
                },
                sent -> {
                    assertThat(sent.email()).isEqualTo("ok@example.com");
                    assertThat(sent.status()).isEqualTo("SENT");
                    assertThat(sent.error()).isNull();
                }
        );
    }

    @Test
    void dedupesDuplicateAdminEmails() {
        when(tenantEspConnectionService.resolveActiveMailgun(TENANT_ID)).thenReturn(Optional.of(CREDENTIALS));
        when(tenantMembershipRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(
                membership(1L, "Admin@Example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN),
                membership(2L, "admin@example.com", UserStatus.ACTIVE, MembershipStatus.ACTIVE, Role.TENANT_ADMIN)
        ));

        MailgunTestEmailService.MailgunTestSendResult result = service.sendTestToTenantAdmins(TENANT_ID);

        assertThat(result.sentCount()).isEqualTo(1);
        verify(mailgunHttpEmailSender, times(1)).send(eq(CREDENTIALS), any());
    }

    private static TenantMembership membership(
            Long userId,
            String email,
            UserStatus userStatus,
            MembershipStatus membershipStatus,
            Role role
    ) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        user.setStatus(userStatus);

        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setTenantId(TENANT_ID);
        membership.setStatus(membershipStatus);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }
}
