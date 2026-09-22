-- Fence claim takeover: an expired sender must not finalize or release the replacement claim.
ALTER TABLE email_deliveries
    ADD COLUMN claim_token UUID;

UPDATE email_deliveries
SET claim_token = gen_random_uuid()
WHERE claim_token IS NULL;

ALTER TABLE email_deliveries
    ALTER COLUMN claim_token SET NOT NULL;
