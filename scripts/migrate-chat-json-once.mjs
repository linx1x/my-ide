#!/usr/bin/env node
/**
 * One-shot migration: import legacy chat_history/*.json files into SQLite (chat_history.db).
 * Run from project root: node scripts/migrate-chat-json-once.mjs
 * History dir: BRIDGE_DATA_DIR or DOCKER_DATA_DIR + /chat_history, or cwd/chat_history.
 */
import { readdirSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_CONVERSATIONS = 50;

function getHistoryDir() {
  const base = process.env.DOCKER_DATA_DIR || process.env.BRIDGE_DATA_DIR;
  if (base) return join(resolve(base), "chat_history");
  return join(resolve(process.cwd()), "chat_history");
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function ensureSchema(db) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (id, phone)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT,
      content TEXT,
      ts INTEGER NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_phone_conversation_ts ON messages (phone, conversation_id, ts);
    CREATE INDEX IF NOT EXISTS idx_conversations_phone_updated ON conversations (phone, updated_at DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, phone, conversation_id, tokenize='unicode61');
    CREATE TABLE IF NOT EXISTS recent_stacks (
      phone TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      used_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recent_stacks_phone_used ON recent_stacks(phone, used_at DESC);
  `);
}

function ensureConversation(db, phone, conversationId, createdAt = Date.now()) {
  db.prepare(`
    INSERT INTO conversations (id, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id, phone) DO UPDATE SET updated_at = excluded.updated_at
  `).run(conversationId, phone, createdAt, Date.now());
}

function trimConversation(db, phone, conversationId) {
  db.prepare(`
    DELETE FROM messages
    WHERE id IN (
      SELECT id FROM messages
      WHERE phone = ? AND conversation_id = ?
      ORDER BY ts DESC, id DESC
      LIMIT -1 OFFSET ?
    )
  `).run(phone, conversationId, MAX_MESSAGES_PER_CONVERSATION);
}

function trimConversations(db, phone) {
  const idsToDelete = db.prepare(`
    SELECT id FROM conversations
    WHERE phone = ?
    ORDER BY updated_at DESC
    LIMIT -1 OFFSET ?
  `).all(phone, MAX_CONVERSATIONS).map((r) => r.id);
  if (idsToDelete.length === 0) return;
  const deleteMsg = db.prepare(`DELETE FROM messages WHERE phone = ? AND conversation_id = ?`);
  const deleteConvo = db.prepare(`DELETE FROM conversations WHERE phone = ? AND id = ?`);
  const tx = db.transaction(() => {
    for (const id of idsToDelete) {
      deleteMsg.run(phone, id);
      deleteConvo.run(phone, id);
    }
  });
  tx();
}

function syncFtsForPhone(db, phone) {
  db.prepare(`DELETE FROM messages_fts WHERE phone = ?`).run(phone);
  db.prepare(`
    INSERT INTO messages_fts (content, phone, conversation_id)
    SELECT content, phone, conversation_id FROM messages WHERE phone = ?
  `).run(phone);
}

function main() {
  const dir = getHistoryDir();
  ensureDir(dir);
  const entries = readdirSync(dir).filter((name) => name.endsWith(".json"));
  if (entries.length === 0) {
    console.log("No legacy .json files in", dir);
    return;
  }
  const dbPath = join(dir, "chat_history.db");
  const db = new Database(dbPath);
  ensureSchema(db);
  const insertMessage = db.prepare(`
    INSERT INTO messages (conversation_id, phone, role, content, ts, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((phone, conversations) => {
    for (const convo of conversations) {
      ensureConversation(db, phone, convo.id, convo.createdAt || Date.now());
      for (const msg of convo.messages || []) {
        insertMessage.run(
          convo.id,
          phone,
          msg.role || "",
          typeof msg.content === "string" ? msg.content : "",
          msg.ts || Date.now(),
          JSON.stringify({ ...msg, role: undefined, content: undefined, ts: undefined })
        );
      }
      db.prepare(`UPDATE conversations SET updated_at = ? WHERE phone = ? AND id = ?`)
        .run(convo.updatedAt || convo.createdAt || Date.now(), phone, convo.id);
      trimConversation(db, phone, convo.id);
    }
    trimConversations(db, phone);
    syncFtsForPhone(db, phone);
  });
  for (const fileName of entries) {
    const phone = fileName.replace(/\.json$/i, "");
    const jsonPath = join(dir, fileName);
    try {
      const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
      tx(phone, Array.isArray(raw?.conversations) ? raw.conversations : []);
      rmSync(jsonPath, { force: true });
      console.log("Migrated and removed:", fileName);
    } catch (err) {
      console.warn("Skip", fileName, err.message);
    }
  }
  db.close();
  console.log("Done.");
}

main();
