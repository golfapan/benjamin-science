CREATE TABLE IF NOT EXISTS learning_sessions (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 state_json TEXT NOT NULL CHECK(json_valid(state_json)),
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_owner_date ON learning_sessions(owner,updated_at);

CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, subject TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_nonces (nonce_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
