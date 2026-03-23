import type pg from "pg";

/**
 * Migration 004 — Add users and refresh_tokens tables (A-01).
 * - users: user accounts with email/password_hash/system_role/is_active
 * - refresh_tokens: active refresh tokens, hashed, FK → users(id) ON DELETE CASCADE
 *
 * NEVER EDIT THIS FILE once it has been applied to any database.
 */
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name  VARCHAR(100) NOT NULL,
      system_role   VARCHAR(20)  NOT NULL DEFAULT 'user',
      is_active     BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  VARCHAR(255) NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ  NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    INSERT INTO db_migrations (version) VALUES (4);

    COMMIT;
  `);
}
