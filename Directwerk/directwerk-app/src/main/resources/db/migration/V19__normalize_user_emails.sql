-- Resolve trim+lowercase email collisions before enabling User.normalizeEmail.
-- Keep the lowest id per canonical email; rewrite later duplicates deterministically.
CREATE TEMP TABLE tmp_user_email_migration (
    user_id BIGINT PRIMARY KEY,
    target_email TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_user_email_migration (user_id, target_email)
WITH ranked AS (
    SELECT
        id,
        lower(trim(email)) AS canonical_email,
        ROW_NUMBER() OVER (
            PARTITION BY lower(trim(email))
            ORDER BY id
        ) AS rn
    FROM users
    WHERE email IS NOT NULL
)
SELECT
    r.id,
    CASE
        WHEN position('@' IN r.canonical_email) > 1 THEN
            split_part(r.canonical_email, '@', 1)
                || '+__migrated-'
                || r.id::text
                || '@'
                || substring(r.canonical_email FROM position('@' IN r.canonical_email) + 1)
        ELSE
            '__migrated-' || r.id::text || '@invalid.local'
    END
FROM ranked r
WHERE r.rn > 1;

UPDATE users u
SET email = '__migrating-' || u.id::text || '@invalid.local'
FROM tmp_user_email_migration t
WHERE u.id = t.user_id;

UPDATE users u
SET email = t.target_email
FROM tmp_user_email_migration t
WHERE u.id = t.user_id
  AND NOT EXISTS (
      SELECT 1
      FROM users existing
      WHERE existing.id <> u.id
        AND lower(trim(existing.email)) = lower(trim(t.target_email))
  );

-- Canonicalize every remaining email to the same form as User.normalizeEmail.
UPDATE users
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email <> lower(trim(email));
