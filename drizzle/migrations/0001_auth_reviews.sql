CREATE TABLE "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE INDEX session_user_id_idx ON "session" (user_id);

CREATE TABLE "account" (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_user_id_idx ON "account" (user_id);
CREATE UNIQUE INDEX account_provider_account_unique ON "account" (provider_id, account_id);

CREATE TABLE "verification" (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_identifier_idx ON "verification" (identifier);

CREATE TABLE rate_limit (
  key text PRIMARY KEY,
  count smallint NOT NULL,
  last_request bigint NOT NULL
);

CREATE TABLE review_write_limit (
  user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  hits smallint NOT NULL DEFAULT 1 CHECK (hits BETWEEN 1 AND 5)
);

CREATE TABLE review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE RESTRICT,
  establishment_id text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_user_establishment_unique UNIQUE (user_id, establishment_id)
);
CREATE INDEX review_establishment_status_created_idx
  ON review (establishment_id, status, created_at);
CREATE INDEX review_user_created_idx ON review (user_id, created_at);

CREATE TABLE review_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES review (id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES "user" (id) ON DELETE RESTRICT,
  previous_status text NOT NULL CHECK (previous_status IN ('published', 'hidden', 'removed')),
  next_status text NOT NULL CHECK (next_status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_moderation_log_review_created_idx
  ON review_moderation_log (review_id, created_at);
