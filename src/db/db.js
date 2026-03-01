import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "bot.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "db", "schema.sql");

export const db = new Database(DB_PATH);

export function initDb() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
}

export function getConfig(key) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row?.value ?? null;
}

export function setConfig(key, value) {
  db.prepare(
    "INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}