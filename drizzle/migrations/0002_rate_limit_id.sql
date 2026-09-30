-- Better Auth's Drizzle adapter expects an id column on every model.
-- Keep existing rate-limit entries while migrating the primary key from key to id.
ALTER TABLE rate_limit ADD COLUMN id text;

UPDATE rate_limit
SET id = gen_random_uuid()::text
WHERE id IS NULL;

ALTER TABLE rate_limit ALTER COLUMN id SET NOT NULL;
ALTER TABLE rate_limit DROP CONSTRAINT rate_limit_pkey;
ALTER TABLE rate_limit ADD CONSTRAINT rate_limit_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX rate_limit_key_unique ON rate_limit (key);
