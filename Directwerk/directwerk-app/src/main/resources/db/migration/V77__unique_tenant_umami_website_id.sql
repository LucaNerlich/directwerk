-- The application pre-check gives tenants an immediate validation error, but only a database
-- uniqueness fence closes the race between concurrent claims from different tenants. PostgreSQL
-- unique indexes already permit multiple NULL values; the predicate keeps the index compact.
--
-- Pre-existing rows may already share a website id (the check was application-only until now),
-- which would abort index creation. Resolve them deterministically first: keep one row per
-- website id (lowest tenant id) and clear the later duplicates so the operator can re-assign
-- them. Affected tenants simply see "Umami is not configured" until they set a new id.
UPDATE tenant_branding tb
SET umami_website_id = NULL
WHERE tb.umami_website_id IS NOT NULL
  AND tb.tenant_id <> (
      SELECT MIN(keep.tenant_id)
      FROM tenant_branding keep
      WHERE keep.umami_website_id = tb.umami_website_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_branding_umami_website_id
    ON tenant_branding (umami_website_id)
    WHERE umami_website_id IS NOT NULL;
