-- #1031: a PUBLISHED PAID bonus file over a PUBLIC asset bypasses the entitlement check,
-- because the download resolver short-circuits PUBLIC assets to the CDN. publish() now rejects
-- that combination; demote pre-existing rows so an operator re-uploads the document as private
-- (the public object itself must still be demoted/deleted in storage).
UPDATE digital_publications p
SET status = 'DRAFT',
    published_at = NULL,
    updated_at = NOW()
FROM media_assets a
WHERE a.id = p.asset_id
  AND p.status = 'PUBLISHED'
  AND p.access_policy = 'PAID'
  AND a.visibility = 'PUBLIC';
