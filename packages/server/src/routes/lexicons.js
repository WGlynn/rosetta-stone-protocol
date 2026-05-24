import express from 'express'
import { createHash } from 'node:crypto'

const router = express.Router()

// Recursive canonical JSON: deterministic key ordering at every depth.
// Required for content_hash stability across machines / re-serializations.
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
}
const keccakHex = (s) => '0x' + createHash('sha256').update(s).digest('hex') // placeholder; swap for real keccak256 lib at deploy time

// GET /lexicons — list all registered lexicons (metadata only)
router.get('/', (req, res) => {
  const rows = req.db.prepare(`
    SELECT id, domain, author_did, primitive_id, content_hash, version, created_at, updated_at
    FROM lexicons
    ORDER BY updated_at DESC
  `).all()
  res.json({ count: rows.length, lexicons: rows })
})

// GET /lexicons/:id — full lexicon contents
router.get('/:id', (req, res) => {
  const row = req.db.prepare('SELECT * FROM lexicons WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  row.concepts = JSON.parse(row.concepts)
  res.json(row)
})

// POST /lexicons — register a new lexicon (or update existing if id matches + author_did matches)
router.post('/', (req, res) => {
  const { id, domain, author_did, concepts } = req.body
  if (!id || !domain || !concepts) {
    return res.status(400).json({ error: 'missing_required', required: ['id', 'domain', 'concepts'] })
  }
  const concepts_json = canonicalize(concepts)
  const content_hash = keccakHex(concepts_json)
  const now = Date.now()

  const existing = req.db.prepare('SELECT author_did, version FROM lexicons WHERE id = ?').get(id)
  if (existing) {
    if (existing.author_did && existing.author_did !== author_did) {
      return res.status(403).json({ error: 'author_mismatch', existing_author: existing.author_did })
    }
    req.db.prepare(`
      UPDATE lexicons SET domain=?, concepts=?, content_hash=?, version=?, updated_at=?
      WHERE id=?
    `).run(domain, concepts_json, content_hash, existing.version + 1, now, id)
    return res.json({ id, version: existing.version + 1, content_hash, action: 'updated' })
  }
  req.db.prepare(`
    INSERT INTO lexicons (id, domain, author_did, primitive_id, content_hash, concepts, version, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)
  `).run(id, domain, author_did || null, content_hash, concepts_json, now, now)
  res.json({ id, version: 1, content_hash, action: 'created' })
})

// PUT /lexicons/:id/primitive — bind lexicon to on-chain PrimitiveRegistry tokenId
// (called once after Bernhard / another author mints their lexicon's NFT on VibeSwap)
router.put('/:id/primitive', (req, res) => {
  const { primitive_id, tx_hash } = req.body
  if (!primitive_id) return res.status(400).json({ error: 'missing_primitive_id' })
  const r = req.db.prepare('UPDATE lexicons SET primitive_id = ?, updated_at = ? WHERE id = ?')
    .run(primitive_id, Date.now(), req.params.id)
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' })
  res.json({ id: req.params.id, primitive_id, tx_hash, action: 'bound' })
})

export default router
