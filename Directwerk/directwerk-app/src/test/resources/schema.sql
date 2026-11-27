-- H2 (MODE=PostgreSQL) has a JSON type but no JSONB alias; the entities declare jsonb columns.
CREATE DOMAIN IF NOT EXISTS JSONB AS JSON;
