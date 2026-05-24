// OPH lexicon import integration test.
//
// Validates that `importLexiconFromJSON` correctly absorbs the fetched
// lexicons/oph.json payload into LEXICONS + the universal-concept graph.
// Does NOT validate Bernhard's graph itself — the edges in oph.json carry
// `extraction_method: 'html-parse'` provenance and remain
// flagged-for-author-confirmation. This test only validates our import path.
//
// Run: node --test src/oph-integration.test.js
//      (from packages/engine/)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  LEXICONS,
  importLexiconFromJSON,
  discoverEquivalent,
} from './engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OPH_JSON_PATH = resolve(__dirname, '../../../lexicons/oph.json')
const ophData = JSON.parse(readFileSync(OPH_JSON_PATH, 'utf8'))

test('oph.json: import returns ≥55 concepts in LEXICONS.oph', () => {
  const result = importLexiconFromJSON(ophData)
  assert.equal(result.id, 'oph')
  assert.ok(
    result.action === 'created' || result.action === 'updated',
    `expected action='created'|'updated', got ${result.action}`,
  )

  const oph = LEXICONS.oph
  assert.ok(oph, 'LEXICONS.oph must exist after import')
  assert.ok(oph.concepts, 'LEXICONS.oph.concepts must exist')

  const conceptCount = Object.keys(oph.concepts).length
  assert.ok(
    conceptCount >= 55,
    `expected ≥55 concepts in LEXICONS.oph, got ${conceptCount}`,
  )
})

test('oph.json: a known concept lands with non-empty desc', () => {
  // karma_functional_k is the OPH ethics-core concept in Q's extraction.
  // (Task spec gave karma_functional as an example; the JSON key is the
  //  more-specific karma_functional_k — verbatim from the fetched lexicon.)
  const concept = LEXICONS.oph.concepts.karma_functional_k
  assert.ok(concept, 'LEXICONS.oph.concepts.karma_functional_k must exist')
  assert.equal(typeof concept.universal, 'string')
  assert.ok(concept.universal.length > 0, 'universal must be non-empty')
  assert.equal(typeof concept.desc, 'string')
  assert.ok(concept.desc.length > 0, 'desc must be non-empty')

  // Spot-check a second philosopher-mapping concept also landed.
  const tegmark = LEXICONS.oph.concepts.philosopher_tegmark
  assert.ok(tegmark, 'philosopher_tegmark concept must land')
  assert.ok(tegmark.desc && tegmark.desc.length > 0)
})

test('oph.json: cross-lexicon bridges land in the universal-index', () => {
  // The bridge mechanism: shared `universal` anchors across lexicons.
  // ethics_in_oph (universal=structural_ethics) should fuzzy-bridge into
  // philosophy via word-overlap (philosophy.utilitarianism has universal
  // consequence_ethics — shared 'ethics' token).
  const result = discoverEquivalent('ethics_in_oph')
  assert.ok(result.found, 'discoverEquivalent must find ethics_in_oph')
  assert.ok(
    Array.isArray(result.equivalents) && result.equivalents.length > 0,
    'must return at least one equivalent',
  )

  // Verify at least one bridge to philosophy OR another OPH-ethics concept.
  const bridges = result.equivalents.filter(
    (e) => e.lexicon === 'philosophy' || e.lexicon === 'oph',
  )
  assert.ok(
    bridges.length >= 1,
    `expected ≥1 bridge to philosophy or oph, got ${bridges.length}. Equivalents: ${JSON.stringify(result.equivalents.map((e) => `${e.lexicon}:${e.term}`))}`,
  )

  // Stronger check: a generic OPH concept (repair → corrective_action)
  // bridges to many other lexicons via the shared universal.
  const repair = discoverEquivalent('repair')
  assert.ok(repair.found, 'discoverEquivalent must find repair')
  const repairLexicons = new Set(repair.equivalents.map((e) => e.lexicon))
  assert.ok(
    repairLexicons.size >= 2,
    `expected repair to bridge ≥2 lexicons, got ${repairLexicons.size}: ${[...repairLexicons].join(',')}`,
  )
})

test('oph.json: repeated import is idempotent (no double-count)', () => {
  const before = Object.keys(LEXICONS.oph.concepts).length
  const r1 = importLexiconFromJSON(ophData)
  const r2 = importLexiconFromJSON(ophData)
  const after = Object.keys(LEXICONS.oph.concepts).length

  assert.equal(
    after,
    before,
    `repeated import must not change concept count (before=${before}, after=${after})`,
  )
  // Second call must be a no-op: concepts_added === 0.
  assert.equal(r2.concepts_added, 0)
  assert.equal(r2.edges_added, 0)
  assert.equal(r2.action, 'updated')
  // First repeat (r1) likely also 0 if a prior test already imported.
  assert.ok(r1.concepts_added === 0 || r1.action === 'created' || r1.action === 'updated')
})
