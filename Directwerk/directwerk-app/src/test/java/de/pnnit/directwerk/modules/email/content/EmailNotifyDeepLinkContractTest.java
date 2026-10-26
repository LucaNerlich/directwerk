package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.repository.ContentNotificationMarkerRepository;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.ObjectMapper;

/**
 * Critical-path contract: content-notify handler resolves locale-prefixed deep links into the
 * email job variables (publish → CONTENT_NOTIFY → email payload). No real Mailgun/SMTP.
 */
@ExtendWith(MockitoExtension.class)
class EmailNotifyDeepLinkContractTest {

    private static final Long TENANT_ID = 42L;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantPublicHostResolver tenantPublicHostResolver;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantContentBrandingResolver tenantContentBrandingResolver;

    @Mock
    private EmailJobProducer emailJobProducer;

    @Mock
    private ObjectProvider<de.pnnit.directwerk.modules.content.NewsletterNotificationApi> newsletterNotificationApi;

    @Mock
    private ContentNotificationMarkerRepository contentNotificationMarkerRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ContentNotifyJobHandler handler;

    @BeforeEach
    void setUp() {
        PublicContentUrlResolver urlResolver = new PublicContentUrlResolver(
                tenantPublicHostResolver, directwerkConfig, tenantRepository);
        handler = new ContentNotifyJobHandler(
                objectMapper,
                tenantMembershipRepository,
                urlResolver,
                tenantContentBrandingResolver,
                emailJobProducer,
                newsletterNotificationApi,
                contentNotificationMarkerRepository,
                directwerkConfig
        );
    }

    @Test
    void episodeNotifyEmailCarriesLocalePrefixedContentUrl() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(tenantPublicHostResolver.findPrimaryVerifiedHost(TENANT_ID))
                .thenReturn(Optional.of("podcast.example"));
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Acme", "Acme Show", "#112233"));
        when(tenantMembershipRepository.findNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership(9L, "listener@example.com", "Listener")));
        when(contentNotificationMarkerRepository.claim(TENANT_ID, ContentType.EPISODE.name(), 55L, 9L))
                .thenReturn(true);

        handler.handle(job(ContentNotifyJobPayload.from(
                ContentType.EPISODE, 55L, "Folge 1", "Teaser", "folge-1", "FREE"
        )));

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID),
                eq("listener@example.com"),
                eq(EmailTemplate.CONTENT_EPISODE_PUBLISHED),
                variables.capture(),
                any()
        );

        String expectedContent = "https://podcast.example/"
                + PublicContentPaths.DEFAULT_LOCALE + "/episodes/folge-1";
        String expectedPrefs = "https://podcast.example/"
                + PublicContentPaths.DEFAULT_LOCALE + "/account";
        assertThat(variables.getValue().get("contentUrl")).isEqualTo(expectedContent);
        assertThat(variables.getValue().get("preferencesUrl")).isEqualTo(expectedPrefs);
        assertThat(variables.getValue().get("title")).isEqualTo("Folge 1");
    }

    @Test
    void episodeNotifyOnLoopbackUsesHttpOrigin() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(tenantPublicHostResolver.findPrimaryVerifiedHost(TENANT_ID))
                .thenReturn(Optional.of("tenant.localhost"));
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Local", "Local", "#000000"));
        when(tenantMembershipRepository.findNotificationOptedInMembers(TENANT_ID, MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership(9L, "listener@example.com", null)));
        when(contentNotificationMarkerRepository.claim(TENANT_ID, ContentType.EPISODE.name(), 55L, 9L))
                .thenReturn(true);

        handler.handle(job(ContentNotifyJobPayload.from(
                ContentType.EPISODE, 55L, "Local ep", null, "local-ep", "FREE"
        )));

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID), eq("listener@example.com"), eq(EmailTemplate.CONTENT_EPISODE_PUBLISHED),
                variables.capture(), any()
        );
        assertThat(variables.getValue().get("contentUrl"))
                .isEqualTo("http://tenant.localhost/" + PublicContentPaths.DEFAULT_LOCALE + "/episodes/local-ep");
    }

    private QueueJob job(ContentNotifyJobPayload payload) {
        Instant now = Instant.parse("2026-10-26T12:00:00Z");
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
