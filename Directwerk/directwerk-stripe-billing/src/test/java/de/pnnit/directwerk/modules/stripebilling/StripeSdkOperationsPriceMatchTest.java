package de.pnnit.directwerk.modules.stripebilling;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.stripe.model.Price;
import com.stripe.model.Price.Recurring;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import org.junit.jupiter.api.Test;

/**
 * Issue #970: unchanged catalog sync must reuse the existing Stripe Price when
 * amount/currency/interval still match — caught here without a live Stripe call.
 */
class StripeSdkOperationsPriceMatchTest {

    @Test
    void matchesIdenticalMonthlyPrice() {
        Price price = price("prod_1", 500L, "eur", "month");

        assertTrue(StripeSdkOperations.priceMatches(
                price, "prod_1", 500L, "EUR", BillingInterval.MONTH));
    }

    @Test
    void rejectsAmountChange() {
        Price price = price("prod_1", 500L, "eur", "month");

        assertFalse(StripeSdkOperations.priceMatches(
                price, "prod_1", 600L, "EUR", BillingInterval.MONTH));
    }

    @Test
    void rejectsIntervalChange() {
        Price price = price("prod_1", 500L, "eur", "month");

        assertFalse(StripeSdkOperations.priceMatches(
                price, "prod_1", 500L, "EUR", BillingInterval.YEAR));
    }

    @Test
    void matchesOneTimeWhenNoRecurring() {
        Price price = price("prod_1", 999L, "usd", null);

        assertTrue(StripeSdkOperations.priceMatches(
                price, "prod_1", 999L, "USD", BillingInterval.ONE_TIME));
    }

    @Test
    void rejectsInactivePrice() {
        Price price = price("prod_1", 500L, "eur", "month");
        price.setActive(false);

        assertFalse(StripeSdkOperations.priceMatches(
                price, "prod_1", 500L, "EUR", BillingInterval.MONTH));
    }

    private static Price price(String productId, long unitAmount, String currency, String interval) {
        Price price = new Price();
        price.setActive(true);
        price.setProduct(productId);
        price.setUnitAmount(unitAmount);
        price.setCurrency(currency);
        if (interval != null) {
            Recurring recurring = new Recurring();
            recurring.setInterval(interval);
            price.setRecurring(recurring);
        }
        return price;
    }
}
