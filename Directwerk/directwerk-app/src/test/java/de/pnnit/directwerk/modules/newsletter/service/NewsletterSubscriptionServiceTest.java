package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NewsletterSubscriptionServiceTest {

    @Mock
    private NewsletterListService newsletterListService;
    @Mock
    private NewsletterSubscriptionRepository subscriptionRepository;
    @Mock
    private FeedTokenProtector feedTokenProtector;
    @Mock
    private TransactionalEmailNotifier emailNotifier;

    private NewsletterSubscriptionService service;

    @BeforeEach
    void setUp() {
        service = new NewsletterSubscriptionService(
                newsletterListService,
                subscriptionRepository,
                feedTokenProtector,
                emailNotifier
        );
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void requestSubscribeCreatesPendingAndSendsConfirmEmail() {
        when(feedTokenProtector.protect(anyString())).thenAnswer(inv -> "enc:" + inv.getArgument(0));
        when(subscriptionRepository.existsByConfirmTokenHash(anyString())).thenReturn(false);
        when(subscriptionRepository.existsByUnsubscribeTokenHash(anyString())).thenReturn(false);
        NewsletterList list = list();
        when(newsletterListService.requireListBySlug(10L, "weekly")).thenReturn(list);
        when(subscriptionRepository.findByListIdAndEmail(1L, "ada@example.com")).thenReturn(Optional.empty());

        service.requestSubscribe(10L, "weekly", "Ada@Example.com");

        ArgumentCaptor<NewsletterSubscription> captor = ArgumentCaptor.forClass(NewsletterSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(NewsletterSubscriptionStatus.PENDING);
        assertThat(captor.getValue().getEmail()).isEqualTo("ada@example.com");
        verify(emailNotifier).sendNewsletterConfirm(eq(10L), eq("ada@example.com"), eq("Weekly"), anyString(), any(Duration.class));
    }

    @Test
    void confirmActivatesSubscription() {
        NewsletterSubscription pending = new NewsletterSubscription();
        pending.setStatus(NewsletterSubscriptionStatus.PENDING);
        pending.setConfirmTokenHash(TokenHashUtil.sha256Hex("raw-confirm"));
        when(subscriptionRepository.findByConfirmTokenHash(TokenHashUtil.sha256Hex("raw-confirm")))
                .thenReturn(Optional.of(pending));

        NewsletterSubscription confirmed = service.confirm("raw-confirm");

        assertThat(confirmed.getStatus()).isEqualTo(NewsletterSubscriptionStatus.ACTIVE);
        assertThat(confirmed.getConfirmTokenHash()).isNull();
        assertThat(confirmed.getConfirmedAt()).isNotNull();
    }

    private static NewsletterList list() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        NewsletterList list = new NewsletterList();
        list.setId(1L);
        list.setTenant(tenant);
        list.setSlug("weekly");
        list.setName("Weekly");
        list.setStatus(NewsletterListStatus.ACTIVE);
        return list;
    }
}
