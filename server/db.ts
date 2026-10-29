import { Database } from "bun:sqlite";

const MIGRATIONS: string[] = [
    `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    username TEXT,
    created_at INTEGER NOT NULL,
    seen_at INTEGER NOT NULL
  );

  CREATE TABLE saved_stops (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code9 TEXT NOT NULL,
    alias TEXT,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, code9)
  );

  CREATE TABLE trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code9 TEXT NOT NULL,
    line TEXT NOT NULL,
    label TEXT,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (user_id, code9, line)
  );

  CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code9 TEXT NOT NULL,
    line TEXT NOT NULL,
    threshold_min INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('once', 'daily')),
    days INTEGER NOT NULL DEFAULT 127,
    from_min INTEGER NOT NULL DEFAULT 0,
    to_min INTEGER NOT NULL DEFAULT 1440,
    expires_at INTEGER,
    last_fired_on TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX alerts_active ON alerts (active, code9);

  CREATE TABLE dir_stops (
    code9 TEXT PRIMARY KEY,
    id INTEGER NOT NULL,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL
  );

  CREATE TABLE dir_routes (
    number TEXT PRIMARY KEY,
    id INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
    `
  ALTER TABLE users ADD COLUMN lang TEXT;
  ALTER TABLE users ADD COLUMN tg_lang TEXT;
  `,
];

export function openDb(path: string): Database {
    const db = new Database(path, { create: true, strict: true });
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA busy_timeout = 3000");
    migrate(db);
    return db;
}

function migrate(db: Database): void {
    const current = (db.query("PRAGMA user_version").get() as { user_version: number }).user_version;
    for (let v = current; v < MIGRATIONS.length; v++) {
        db.transaction(() => {
            db.run(MIGRATIONS[v]!);
            db.run(`PRAGMA user_version = ${v + 1}`);
        })();
    }
}

export function getMeta(db: Database, key: string): string | null {
    return (db.query("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | null)?.value ?? null;
}

export function setMeta(db: Database, key: string, value: string): void {
    db.query("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
