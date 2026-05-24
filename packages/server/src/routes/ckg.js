import express from 'express'
import { createHash } from 'node:crypto'

const router = express.Router()

// GET /ckg/:snapshot_id — retrieve a saved CKG snapshot
router.get('/:snapshot_id', (req, res) => {
  const row = req.db.prepare('SELECT * FROM ckg_state WHERE snapshot_id = ?').get(req.params.snapshot_id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  row.state_json = JSON.parse(row.state_json)
  res.json(row)
})

// POST /ckg — persist a CKG snapshot
router.post('/', (req, res) => {
  const { snapshot_id, author_did, state, log_hash } = req.body
  if (!snapshot_id || !state) {
    return res.status(400).json({ error: 'missing_required', required: ['snapshot_id', 'state'] })
  }
  const state_json = JSON.stringify(state)
  const final_log_hash = log_hash || '0x' + createHash('sha256').update(state_json).digest('hex')
  req.db.prepare(`
    INSERT OR REPLACE INTO ckg_state (snapshot_id, author_did, state_json, log_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(snapshot_id, author_did || null, state_json, final_log_hash, Date.now())
  res.json({ snapshot_id, log_hash: final_log_hash, action: 'persisted' })
})

export default router
