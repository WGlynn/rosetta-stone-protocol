// Rosetta Stone Protocol — Backend
// Lexicon registry + CKG persistence. SQLite by default.
// Routes are minimal-viable: GET/POST lexicons, GET/POST CKG state.
// Future: adapters/psinet.js federates lexicon publish via VibeSwap PrimitiveRegistry.

import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'

import lexiconsRouter from './routes/lexicons.js'
import ckgRouter from './routes/ckg.js'
import attributionRouter from './routes/attribution.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.ROSETTA_DB || path.join(__dirname, '..', 'rosetta.sqlite')
const PORT = process.env.PORT || 4242

// ============ DB init ============

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS lexicons (
    id              TEXT PRIMARY KEY,
    domain          TEXT NOT NULL,
    author_did      TEXT,
    primitive_id    INTEGER,  -- PrimitiveRegistry tokenId once minted; NULL until on-chain
    content_hash    TEXT NOT NULL,   -- keccak256 of canonicalized JSON
    concepts        TEXT NOT NULL,   -- JSON blob
    version         INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ckg_state (
    snapshot_id     TEXT PRIMARY KEY,
    author_did      TEXT,
    state_json      TEXT NOT NULL,
    log_hash        TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS translations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    from_lexicon    TEXT NOT NULL,
    to_lexicon      TEXT NOT NULL,
    concept         TEXT NOT NULL,
    routed_via      TEXT,            -- JSON array of intermediate lexicons used
    consumer_did    TEXT,
    fire_id         TEXT NOT NULL,
    timestamp       INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_translations_routed_via ON translations(routed_via);
  CREATE INDEX IF NOT EXISTS idx_translations_timestamp ON translations(timestamp);

  CREATE TABLE IF NOT EXISTS citation_epochs (
    epoch_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    merkle_root     TEXT NOT NULL,
    per_lexicon_counts TEXT NOT NULL,  -- JSON: { lexicon_id: count }
    anchored_tx     TEXT,                -- L1 tx hash once anchored via CitationAnchor.sol
    sealed_at       INTEGER NOT NULL
  );
`)

// ============ App ============

const app = express()
app.use(cors())
app.use(express.json({ limit: '4mb' }))

// Inject db into req for handlers
app.use((req, _res, next) => {
  req.db = db
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', db: DB_PATH })
})

app.use('/lexicons', lexiconsRouter)
app.use('/ckg', ckgRouter)
app.use('/attribution', attributionRouter)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Rosetta server on :${PORT} (db=${DB_PATH})`)
})
