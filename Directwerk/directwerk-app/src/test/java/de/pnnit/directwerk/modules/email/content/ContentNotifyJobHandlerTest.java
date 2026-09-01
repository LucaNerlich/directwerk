package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class ContentNotifyJobHandlerTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private ContentPublicUrlBuilder contentPublicUrlBuilder;

    @Mock
    private TenantContentBrandingResolver tenantContentBrandingResolver;

    @Mock
    private EmailJobProducer emailJobProducer;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ContentNotifyJobHandler handler;

    @BeforeEach
    void setUp() {
        handler = new ContentNotifyJobHandler(
                objectMapper,
                tenantMembershipRepository,
                contentPublicUrlBuilder,
                tenantContentBrandingResolver,
                emailJobProducer
        );
    }

    @Test
    void queueNameIsContentNotify() {
        assertThat(handler.queueName()).isEqualTo(QueueNames.CONTENT_NOTIFY);
    }

    @Test
    void notifiesEachOptedInRecipientWithPerUserCorrelationId() {
        when(contentPublicUrlBuilder.buildPublicContentUrl(TENANT_ID, ContentType.ARTICLE, "hello-world"))
                .thenReturn("https://tenant.example/articles/hello-world");
        when(contentPublicUrlBuilder.buildNotificationPreferencesUrl(TENANT_ID))
                .thenReturn("https://tenant.example/account/notifications");
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Acme", "Acme Magazine", "#123456"));
        TenantMembership first = membership(1L, "ada@example.com", "Ada");
        TenantMembership second = membership(2L, "grace@example.com", null);
        when(tenantMembershipRepository.findNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(List.of(first, second));

        handler.handle(job(ContentNotifyJobPayload.from(
                ContentType.ARTICLE,
                7L,
                "Hello world",
                "An excerpt",
                "hello-world",
                "FREE"
        )));

        ArgumentCaptor<Map<String, String>> variablesCaptor = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID),
                eq("ada@example.com"),
                eq(EmailTemplate.CONTENT_ARTICLE_PUBLISHED),
                variablesCaptor.capture(),
                eq("content-notify-article-7-user-1")
        );
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID),
                eq("grace@example.com"),
                eq(EmailTemplate.CONTENT_ARTICLE_PUBLISHED),
                any(),
                eq("content-notify-article-7-user-2")
        );

        Map<String, String> variables = variablesCaptor.getValue();
        assertThat(variables.get("recipientName")).isEqualTo("Ada");
        assertThat(variables.get("tenantName")).isEqualTo("Acme");
        assertThat(variables.get("siteTitle")).isEqualTo("Acme Magazine");
        assertThat(variables.get("title")).isEqualTo("Hello world");
        assertThat(variables.get("contentUrl")).isEqualTo("https://tenant.example/articles/hello-world");
        assertThat(variables.get("preferencesUrl")).isEqualTo("https://tenant.example/account/notifications");
        assertThat(variables.get("primaryColor")).isEqualTo("#123456");
    }

    @Test
    void defaultsMissingRecipientNameToThere() {
        when(contentPublicUrlBuilder.buildPublicContentUrl(any(), any(), any())).thenReturn("https://tenant.example/x");
        when(contentPublicUrlBuilder.buildNotificationPreferencesUrl(any())).thenReturn("https://tenant.example/prefs");
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Acme", "Acme", "#000000"));
        when(tenantMembershipRepository.findNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership(2L, "grace@example.com", null)));

        handler.handle(job(ContentNotifyJobPayload.from(
                ContentType.EPISODE, 3L, "New episode", null, "ep-3", "FREE"
        )));

        ArgumentCaptor<Map<String, String>> variablesCaptor = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID), eq("grace@example.com"), eq(EmailTemplate.CONTENT_EPISODE_PUBLISHED), variablesCaptor.capture(), any()
        );
        assertThat(variablesCaptor.getValue().get("recipientName")).isEqualTo("there");
        assertThat(variablesCaptor.getValue().get("excerpt")).isEmpty();
    }

    @Test
    void skipsEnqueueWhenNoRecipientsOptedIn() {
        when(contentPublicUrlBuilder.buildPublicContentUrl(any(), any(), any())).thenReturn("https://tenant.example/x");
        when(contentPublicUrlBuilder.buildNotificationPreferencesUrl(any())).thenReturn("https://tenant.example/prefs");
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Acme", "Acme", "#000000"));
        when(tenantMembershipRepository.findNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(List.of());

        handler.handle(job(ContentNotifyJobPayload.from(ContentType.ARTICLE, 7L, "Hello", null, "hello", "FREE")));

        verify(emailJobProducer, never()).enqueueContentNotification(any(), any(), any(), any(), any());
    }

    @Test
    void rejectsPayloadMissingContentId() {
        QueueJob invalidJob = job(new ContentNotifyJobPayload(ContentType.ARTICLE.name(), null, "t", null, "s", "FREE"));

        assertThatThrownBy(() -> handler.handle(invalidJob)).isInstanceOf(IllegalArgumentException.class);
        verify(emailJobProducer, never()).enqueueContentNotification(any(), any(), any(), any(), any());
    }

    private QueueJob job(ContentNotifyJobPayload payload) {
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.CONTENT_NOTIFY,
                objectMapper.valueToTree(payload),
                0,
                JobStatus.PROCESSING,
                now,
                0,
                5,
                null,
                null,
                null,
                TENANT_ID,
                null,
                null,
                now,
                now
        );
    }

    private static TenantMembership membership(Long userId, String email, String name) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        user.setName(name);

        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        return membership;
    }
}
