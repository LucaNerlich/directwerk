CREATE TABLE email_deliveries (
    job_id UUID PRIMARY KEY,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
