import express from 'express'
import { createHash } from 'node:crypto'

const router = express.Router()

// POST /attribution/translation — log a translation event with routing trail
// Called by Rosetta clients on every translate() call. Builds the citation count
// per lexicon for the next CitationAnchor epoch merkle root.
router.post('/translation', (req, res) => {
  const { from_lexicon, to_lexicon, concept, routed_via, consumer_did, fire_id } = req.body
  if (!from_lexicon || !to_lexicon || !concept || !fire_id) {
    return res.status(400).json({ error: 'missing_required' })
  }
  req.db.prepare(`
    INSERT INTO translations (from_lexicon, to_lexicon, concept, routed_via, consumer_did, fire_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    from_lexicon,
    to_lexicon,
    concept,
    JSON.stringify(routed_via || []),
    consumer_did || null,
    fire_id,
    Date.now(),
  )
  res.json({ logged: true })
})

// GET /attribution/epoch/:epoch_id — read a sealed citation epoch
router.get('/epoch/:epoch_id', (req, res) => {
  const row = req.db.prepare('SELECT * FROM citation_epochs WHERE epoch_id = ?').get(req.params.epoch_id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  row.per_lexicon_counts = JSON.parse(row.per_lexicon_counts)
  res.json(row)
})

// POST /attribution/epoch/seal — seal current accumulating citation counts into a new epoch
// merkle root, ready to anchor on-chain via CitationAnchor.anchorCitations()
router.post('/epoch/seal', (req, res) => {
  // Aggregate per-lexicon counts since last sealed epoch
  const last = req.db.prepare('SELECT MAX(sealed_at) as last_at FROM citation_epochs').get()
  const since = last?.last_at || 0
  const rows = req.db.prepare(`
    SELECT routed_via, COUNT(*) as n
    FROM translations
    WHERE timestamp > ?
    GROUP BY routed_via
  `).all(since)

  // Roll up routed_via JSON arrays into per-lexicon counts
  const perLexicon = {}
  for (const r of rows) {
    const path = JSON.parse(r.routed_via || '[]')
    for (const lex of path) {
      perLexicon[lex] = (perLexicon[lex] || 0) + r.n
    }
  }

  // Naive merkle root: keccak256 of sorted "lex:count" lines
  const lines = Object.entries(perLexicon).sort().map(([k, v]) => `${k}:${v}`).join('\n')
  const merkle_root = '0x' + createHash('sha256').update(lines).digest('hex')

  const r = req.db.prepare(`
    INSERT INTO citation_epochs (merkle_root, per_lexicon_counts, anchored_tx, sealed_at)
    VALUES (?, ?, NULL, ?)
  `).run(merkle_root, JSON.stringify(perLexicon), Date.now())

  res.json({
    epoch_id: r.lastInsertRowid,
    merkle_root,
    per_lexicon_counts: perLexicon,
    next_step: 'anchor_onchain_via_CitationAnchor.anchorCitations',
  })
})

export default router
