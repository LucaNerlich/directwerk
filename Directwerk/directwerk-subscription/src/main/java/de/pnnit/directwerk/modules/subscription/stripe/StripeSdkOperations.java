package de.pnnit.directwerk.modules.subscription.stripe;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Charge;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Price;
import com.stripe.model.Product;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.ProductCreateParams;
import com.stripe.param.ProductUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.exception.StripeApiException;
import de.pnnit.directwerk.modules.subscription.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.subscription.exception.StripeSignatureException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class StripeSdkOperations implements StripeOperations {

    private final StripeProperties properties;

    public StripeSdkOperations(StripeProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean isConfigured() {
        return properties.isConfigured();
    }

    @Override
    public boolean isWebhookConfigured() {
        return properties.isWebhookConfigured();
    }

    @Override
    public ConnectedAccount createExpressAccount(String country, Map<String, String> metadata) {
        requireConfigured();
        try {
            AccountCreateParams.Builder builder = AccountCreateParams.builder()
                    .setType(AccountCreateParams.Type.EXPRESS)
                    .setCountry(country)
                    .setCapabilities(AccountCreateParams.Capabilities.builder()
                            .setCardPayments(AccountCreateParams.Capabilities.CardPayments.builder()
                                    .setRequested(true)
                                    .build())
                            .setTransfers(AccountCreateParams.Capabilities.Transfers.builder()
                                    .setRequested(true)
                                    .build())
                            .build());
            metadata.forEach(builder::putMetadata);
            Account account = Account.create(builder.build(), platformOptions());
            return toConnectedAccount(account);
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public ConnectedAccount retrieveAccount(String accountId) {
        requireConfigured();
        try {
            return toConnectedAccount(Account.retrieve(accountId, platformOptions()));
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public String createAccountLink(String accountId, String refreshUrl, String returnUrl) {
        requireConfigured();
        try {
            AccountLink link = AccountLink.create(
                    AccountLinkCreateParams.builder()
                            .setAccount(accountId)
                            .setRefreshUrl(refreshUrl)
                            .setReturnUrl(returnUrl)
                            .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                            .build(),
                    platformOptions()
            );
            return link.getUrl();
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public CatalogIds upsertProductAndPrice(
            String accountId,
            String existingProductId,
            String title,
            String description,
            long priceCents,
            String currency,
            BillingInterval interval
    ) {
        requireConfigured();
        RequestOptions connected = connectedOptions(accountId);
        try {
            String productId = existingProductId;
            if (productId == null || productId.isBlank()) {
                ProductCreateParams.Builder productBuilder = ProductCreateParams.builder()
                        .setName(title)
                        .setActive(true);
                if (description != null && !description.isBlank()) {
                    productBuilder.setDescription(description);
                }
                productId = Product.create(productBuilder.build(), connected).getId();
            } else {
                ProductUpdateParams.Builder update = ProductUpdateParams.builder()
                        .setName(title)
                        .setActive(true);
                if (description != null && !description.isBlank()) {
                    update.setDescription(description);
                }
                Product.retrieve(productId, connected).update(update.build(), connected);
            }

            PriceCreateParams.Builder priceBuilder = PriceCreateParams.builder()
                    .setProduct(productId)
                    .setCurrency(currency.toLowerCase())
                    .setUnitAmount(priceCents)
                    .setActive(true);
            if (interval == BillingInterval.MONTH) {
                priceBuilder.setRecurring(PriceCreateParams.Recurring.builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
                        .build());
            } else if (interval == BillingInterval.YEAR) {
                priceBuilder.setRecurring(PriceCreateParams.Recurring.builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.YEAR)
                        .build());
            }
            String priceId = Price.create(priceBuilder.build(), connected).getId();
            return new CatalogIds(productId, priceId);
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public String createCustomer(String accountId, String email, Map<String, String> metadata) {
        requireConfigured();
        try {
            CustomerCreateParams.Builder builder = CustomerCreateParams.builder().setEmail(email);
            metadata.forEach(builder::putMetadata);
            return Customer.create(builder.build(), connectedOptions(accountId)).getId();
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public CheckoutSessionResult createCheckoutSession(CheckoutSessionCommand command) {
        requireConfigured();
        try {
            SessionCreateParams.Builder builder = SessionCreateParams.builder()
                    .setMode(command.interval() == BillingInterval.ONE_TIME
                            ? SessionCreateParams.Mode.PAYMENT
                            : SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(command.customerId())
                    .setSuccessUrl(command.successUrl())
                    .setCancelUrl(command.cancelUrl())
                    .setAllowPromotionCodes(true)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(command.priceId())
                            .setQuantity(1L)
                            .build());
            command.metadata().forEach(builder::putMetadata);
            if (command.interval() == BillingInterval.ONE_TIME) {
                SessionCreateParams.PaymentIntentData.Builder paymentIntentData =
                        SessionCreateParams.PaymentIntentData.builder();
                command.metadata().forEach(paymentIntentData::putMetadata);
                builder.setPaymentIntentData(paymentIntentData.build());
            } else {
                SessionCreateParams.SubscriptionData.Builder subscriptionData =
                        SessionCreateParams.SubscriptionData.builder();
                command.metadata().forEach(subscriptionData::putMetadata);
                builder.setSubscriptionData(subscriptionData.build());
            }
            Session session = Session.create(builder.build(), connectedOptions(command.accountId()));
            return new CheckoutSessionResult(session.getId(), session.getUrl());
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public String createPortalSession(String accountId, String customerId, String returnUrl) {
        requireConfigured();
        try {
            com.stripe.param.billingportal.SessionCreateParams params =
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(customerId)
                            .setReturnUrl(returnUrl)
                            .build();
            return com.stripe.model.billingportal.Session.create(params, connectedOptions(accountId)).getUrl();
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public void cancelSubscription(String accountId, String subscriptionId) {
        requireConfigured();
        try {
            Subscription.retrieve(subscriptionId, connectedOptions(accountId))
                    .cancel((Map<String, Object>) null, connectedOptions(accountId));
        } catch (StripeException ex) {
            throw wrap(ex);
        }
    }

    @Override
    public StripeWebhookPayload parseWebhook(String payload, String signature) {
        if (!isWebhookConfigured()) {
            throw new StripeNotConfiguredException("Stripe webhook secret is not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signature, properties.webhookSecret());
        } catch (SignatureVerificationException ex) {
            throw new StripeSignatureException("Stripe webhook signature is invalid", ex);
        }
        StripeObject stripeObject = event.getDataObjectDeserializer().getObject().orElse(null);
        return extractPayload(event, stripeObject);
    }

    private StripeWebhookPayload extractPayload(Event event, StripeObject stripeObject) {
        String accountId = event.getAccount();
        String customerId = null;
        String subscriptionId = null;
        String stripePriceId = null;
        String paymentIntentId = null;
        Instant periodEnd = null;
        String stripeStatus = null;
        boolean chargesEnabled = false;
        boolean payoutsEnabled = false;
        boolean detailsSubmitted = false;
        boolean fullyRefunded = false;
        Map<String, String> metadata = new HashMap<>();

        if (stripeObject instanceof Session session) {
            customerId = session.getCustomer();
            subscriptionId = session.getSubscription();
            paymentIntentId = session.getPaymentIntent();
            if (session.getMetadata() != null) {
                metadata.putAll(session.getMetadata());
            }
        } else if (stripeObject instanceof Charge charge) {
            customerId = charge.getCustomer();
            paymentIntentId = charge.getPaymentIntent();
            fullyRefunded = Boolean.TRUE.equals(charge.getRefunded())
                    || (charge.getAmount() != null
                    && charge.getAmountRefunded() != null
                    && charge.getAmountRefunded() >= charge.getAmount());
            if (charge.getMetadata() != null) {
                metadata.putAll(charge.getMetadata());
            }
        } else if (stripeObject instanceof Subscription subscription) {
            customerId = subscription.getCustomer();
            subscriptionId = subscription.getId();
            stripeStatus = subscription.getStatus();
            if (subscription.getCurrentPeriodEnd() != null) {
                periodEnd = Instant.ofEpochSecond(subscription.getCurrentPeriodEnd());
            }
            if (subscription.getItems() != null
                    && subscription.getItems().getData() != null
                    && !subscription.getItems().getData().isEmpty()
                    && subscription.getItems().getData().getFirst().getPrice() != null) {
                stripePriceId = subscription.getItems().getData().getFirst().getPrice().getId();
            }
            if (subscription.getMetadata() != null) {
                metadata.putAll(subscription.getMetadata());
            }
        } else if (stripeObject instanceof Invoice invoice) {
            customerId = invoice.getCustomer();
            subscriptionId = invoice.getSubscription();
            if (invoice.getMetadata() != null) {
                metadata.putAll(invoice.getMetadata());
            }
        } else if (stripeObject instanceof Account account) {
            accountId = account.getId();
            chargesEnabled = Boolean.TRUE.equals(account.getChargesEnabled());
            payoutsEnabled = Boolean.TRUE.equals(account.getPayoutsEnabled());
            detailsSubmitted = Boolean.TRUE.equals(account.getDetailsSubmitted());
        }

        return new StripeWebhookPayload(
                event.getId(),
                event.getType(),
                accountId,
                customerId,
                subscriptionId,
                stripePriceId,
                periodEnd,
                stripeStatus,
                chargesEnabled,
                payoutsEnabled,
                detailsSubmitted,
                Map.copyOf(metadata),
                paymentIntentId,
                fullyRefunded
        );
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new StripeNotConfiguredException("Stripe secret key is not configured");
        }
    }

    private RequestOptions platformOptions() {
        return RequestOptions.builder().setApiKey(properties.secretKey()).build();
    }

    private RequestOptions connectedOptions(String accountId) {
        return RequestOptions.builder()
                .setApiKey(properties.secretKey())
                .setStripeAccount(accountId)
                .build();
    }

    private static ConnectedAccount toConnectedAccount(Account account) {
        return new ConnectedAccount(
                account.getId(),
                Boolean.TRUE.equals(account.getChargesEnabled()),
                Boolean.TRUE.equals(account.getPayoutsEnabled()),
                Boolean.TRUE.equals(account.getDetailsSubmitted())
        );
    }

    private static StripeApiException wrap(StripeException ex) {
        return new StripeApiException("Stripe request failed", ex);
    }
}
