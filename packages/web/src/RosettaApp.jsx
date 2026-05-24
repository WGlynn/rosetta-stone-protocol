import { useState, useMemo } from 'react'
import {
  LEXICONS,
  translate,
  translateToAll,
  discoverEquivalent,
  getProtocolStats,
  getDetailedStats,
  importLexiconFromJSON,
} from '@rosetta/engine'
import ophData from '../../../lexicons/oph.json'

// Wire fetched lexicons into the engine at module load — before React renders.
// Vite handles JSON imports natively; the parsed object is merged into the
// in-process LEXICONS registry by importLexiconFromJSON (idempotent on HMR).
// Provenance flag: oph.json was extracted via html-parse against
// idea-graph-scribe.lovable.app; edges are semantic reconstructions
// flagged-for-Bernhard-confirmation, not authoritative export.
importLexiconFromJSON(ophData)

// Minimal standalone Rosetta web UI. Lives in the rosetta-stone-protocol
// monorepo so the engine can be developed + tested without dragging in the
// vibeswap frontend. The canonical full-featured viewer is still at
// vibeswap-app.vercel.app/rosetta; this is the engine demo + contribution
// surface for new lexicons.

const LEXICON_IDS = Object.keys(LEXICONS).sort()

export default function RosettaApp() {
  const [from, setFrom] = useState('philosophy')
  const [to, setTo] = useState('oph')
  const [term, setTerm] = useState('')
  const [showAll, setShowAll] = useState(false)

  const fromConcepts = useMemo(
    () => Object.keys(LEXICONS[from]?.concepts || {}).sort(),
    [from],
  )

  const result = useMemo(() => {
    if (!term) return null
    if (showAll) return translateToAll(from, term)
    return translate(from, to, term)
  }, [term, from, to, showAll])

  const stats = useMemo(() => getProtocolStats(), [])

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui' }}>
      <header style={{ padding: '24px', borderBottom: '1px solid rgba(0,255,65,0.2)' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.30em', textTransform: 'uppercase', color: '#34d399' }}>
          rosetta_stone_protocol(v0.1) → universal cross-domain translation
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginTop: 8 }}>
          Rosetta <span style={{ color: '#34d399' }}>Stone</span> Protocol
        </h1>
        <p style={{ color: '#999', maxWidth: 720, marginTop: 8 }}>
          {stats.lexicons} lexicons · {stats.concepts} concepts. Client-side translation.
          On-chain attribution via VibeSwap ContributionDAG + ShapleyDistributor.
        </p>
      </header>

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontFamily: 'ui-monospace, monospace' }}>FROM</div>
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              style={{ width: '100%', padding: 8, background: '#111', color: '#fff', border: '1px solid #333' }}>
              {LEXICON_IDS.map((id) => <option key={id} value={id}>{LEXICONS[id].domain}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontFamily: 'ui-monospace, monospace' }}>CONCEPT</div>
            <select value={term} onChange={(e) => setTerm(e.target.value)}
              style={{ width: '100%', padding: 8, background: '#111', color: '#fff', border: '1px solid #333' }}>
              <option value=''>—</option>
              {fromConcepts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontFamily: 'ui-monospace, monospace' }}>TO</div>
            <select value={to} onChange={(e) => setTo(e.target.value)} disabled={showAll}
              style={{ width: '100%', padding: 8, background: '#111', color: '#fff', border: '1px solid #333' }}>
              {LEXICON_IDS.map((id) => <option key={id} value={id}>{LEXICONS[id].domain}</option>)}
            </select>
          </label>
        </section>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#999' }}>
            <input type='checkbox' checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all translations
          </label>
        </div>

        <section style={{ border: '1px solid #222', borderRadius: 8, padding: 16, minHeight: 200, background: '#0a0a0a' }}>
          {!term && <div style={{ color: '#666' }}>Pick a source lexicon + concept above.</div>}
          {term && !showAll && result && (
            <div>
              <div style={{ color: '#34d399', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                {from} → {to}
              </div>
              <div style={{ fontSize: 20, marginTop: 8 }}>
                {result.translated ? result.to_term : '(no direct match)'}
              </div>
              {result.universal && (
                <div style={{ color: '#666', fontSize: 12, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
                  universal: {result.universal}
                </div>
              )}
              {result.to_desc && <div style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>{result.to_desc}</div>}
              {result.approximate && <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 6 }}>approximate match (confidence: {result.confidence}%)</div>}
              {result.didYouMean && <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>did you mean: <code>{result.didYouMean}</code></div>}
            </div>
          )}
          {term && showAll && Array.isArray(result) && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {result.length === 0 && <li style={{ color: '#666' }}>No translations found.</li>}
              {result.map((r) => (
                <li key={r.agent} style={{ padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <span style={{ color: '#34d399', fontFamily: 'ui-monospace, monospace', fontSize: 10, marginRight: 12 }}>{r.agent}</span>
                  <span>{r.term}</span>
                  <span style={{ color: '#666', fontSize: 11, marginLeft: 8 }}>({r.confidence}%{r.approximate ? ' approx' : ''})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
