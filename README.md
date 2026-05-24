# Rosetta Stone Protocol

> Universal cross-domain concept translation. Each lexicon is a domain's
> language; the engine routes concepts between them via shared universal
> primitives. Designed to bind authorship on-chain through VibeSwap's
> `PrimitiveRegistry` + `ContributionDAG` + `ShapleyDistributor` so that
> citation flows generate royalty attribution by structure, not promise.

**Status: v0.1.0 — production-grade installable starting point.**
Engine is extracted from the working VibeSwap frontend `/rosetta` route.
Server is local-first SQLite (single-node, not multi-tenant cloud).
On-chain attribution is spec'd in this repo against deployed VibeSwap
contracts — the wiring (PrimitiveRegistry binding + CitationAnchor epoch
sealing) is implemented as integration points, not yet end-to-end live.

---

## What this is

A monorepo with three packages:

| Package | Purpose | Run-mode |
|---|---|---|
| `@rosetta/engine` | Pure ESM translation engine. Lexicons + concept graph + `translate` / `translateToAll` / `discoverEquivalent` / `composeLexicon` / `lexiconShapley`. | Embeds in any JS runtime. |
| `@rosetta/server` | Node + Express + better-sqlite3 backend. Lexicon registry, CKG snapshots, translation citation logging, epoch sealing. | Local-first SQLite. |
| `@rosetta/web` | Vite + React demo SPA. Shows the engine running against the bundled in-memory lexicons. | Localhost dev server. |

Plus `lexicons/` — the contribution surface for new domain lexicons.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/WGlynn/rosetta-stone-protocol.git
cd rosetta-stone-protocol

# 2. Install (npm workspaces)
bash install.sh                        # or just: npm install

# 3. Start the server
npm run dev:server                     # http://localhost:4242

# 4. Start the web demo (in a second terminal)
npm run dev:web                        # http://localhost:3001
```

Smoke test:

```bash
curl http://localhost:4242/health
# -> { "ok": true, "version": "0.1.0", "db": "..." }
```

---

## API

The server exposes three resource families. SQLite schema is created
lazily on first boot.

### `/lexicons` — lexicon registry

```
GET    /lexicons                 list all registered lexicons (metadata)
GET    /lexicons/:id             full lexicon contents
POST   /lexicons                 register a new lexicon (or version-bump an existing one)
PUT    /lexicons/:id/primitive   bind lexicon to its on-chain PrimitiveRegistry tokenId
```

Lexicon shape:

```json
{
  "id": "oph",
  "domain": "Observer-Patch Holography",
  "author_did": "did:key:z6Mk...",
  "concepts": {
    "observer_patch":  { "universal": "bounded_perspective", "desc": "..." },
    "mismatch":        { "universal": "consistency_break",   "desc": "..." }
  }
}
```

Content hashing: the server canonicalizes concept JSON (sorted keys) and
stores `content_hash = sha256(canonical_json)`. At deploy time this swaps
for `keccak256` to match the on-chain hash. The `keccakHex` helper in
`packages/server/src/routes/lexicons.js` is the swap-point.

### `/ckg` — Compiled Knowledge Graph snapshots

```
GET    /ckg/:snapshot_id         retrieve a saved CKG snapshot
POST   /ckg                      persist a CKG snapshot
```

### `/attribution` — translation citations + epoch sealing

```
POST   /attribution/translation     log a translation event (called by every translate())
GET    /attribution/epoch/:id       read a sealed citation epoch
POST   /attribution/epoch/seal      seal accumulated citations into a new merkle epoch
```

The `epoch/seal` route aggregates `routed_via` paths from every logged
translation since the last sealed epoch, rolls them up to per-lexicon
citation counts, and emits a `merkle_root` ready to anchor on-chain via
`CitationAnchor.anchorCitations(merkle_root)`.

---

## On-chain attribution (integration points)

The whole point of the Rosetta Stone Protocol is that **citation flow ⇒
authorship attribution by structure**, not by promise. Integration with
VibeSwap closes that loop. Three contracts do the load-bearing work:

| Contract | Role |
|---|---|
| `PrimitiveRegistry` | Each lexicon = one Primitive NFT. `mint()` binds `(content_hash, author)` to a tokenId. The server's `PUT /lexicons/:id/primitive` writes the tokenId back. |
| `ContributionDAG` | Records the citation graph: lexicon A → lexicon B edges, weighted by translation count from the sealed epochs. |
| `ShapleyDistributor` | Computes marginal-contribution rewards across the DAG. Foundational lexicons (cited via many translation paths) earn more by structure — the Cave Theorem. |

The integration points are **spec'd in this repo against named contracts**;
the audits workspace tracks the federation + escrow + storage work that
this repo plugs into:

- `audits/psinet-mindmesh-cycle-1/agent-A-primitive-nft.md` — PrimitiveRegistry design
- `audits/psinet-mindmesh-cycle-1/agent-B-datatoken-exchange.md` — Lexicon datatoken pricing
- `audits/psinet-mindmesh-cycle-1/agent-C-mindmesh-federation.md` — MindMesh peer publishing
- `audits/psinet-mindmesh-cycle-2/agent-D-honest-attestation.md` — Author attestation discipline
- `audits/psinet-mindmesh-cycle-2/agent-E-privacy-revocation-keyrotation.md` — Author key rotation
- `audits/psinet-mindmesh-cycle-3/agent-G-escrow-vault.md` — Citation royalty escrow

**Honest-number**: the contract names + their roles are deployed against
VibeSwap's existing Primitive / DAG / Shapley stack on testnet; the
end-to-end wiring **from this server through to a settled royalty payout**
is not yet executed end-to-end. The server emits the merkle root; the
anchor + payout cycle is the next milestone.

---

## Upcoming major lexicons

The protocol becomes load-bearing only when authoritative domain experts
publish their own lexicons. Two are already in flight:

- **Observer-Patch Holography (OPH)** — Bernhard Mueller's concept graph.
  Source-of-truth visualization: <https://idea-graph-scribe.lovable.app/>.
  OPH is intended to function as the first major cross-domain bridge —
  its primitives (`observer_patch`, `mismatch`, `repair`, `record`,
  `holonomy_defect`) connect sociology, politics, economics, philosophy,
  and math under a single mathematical structure. When OPH's lexicon
  lands as `lexicons/oph.json`, the engine's `composeLexicon` +
  `discoverEquivalent` operations will route translations through OPH
  automatically wherever a universal concept aligns.

- **"Another World Becomes Possible"** — Crys's 20-chapter book. A
  candidate lexicon mapping each chapter's vocabulary into the universal
  concept space. Brings narrative / political / economic primitives into
  the cross-domain graph.

---

## The 4-substrate convergence

Rosetta is one of four substrates Will + JARVIS are extracting from the
same structural-property research thread:

1. **VibeSwap** — omnichain DEX, MEV-free batch auctions, on-chain attribution stack (`PrimitiveRegistry` + `ContributionDAG` + `ShapleyDistributor`)
2. **JARVIS-OS** — cognition shell + memory + hook gates (`github.com/WGlynn/jarvis-os` — sibling installable)
3. **Rosetta Stone Protocol** — *this repo* — universal cross-domain translation as a public substrate
4. **OPH (Observer-Patch Holography)** — Bernhard Mueller's mathematical framework, lexicon pending

All four resolve the same underlying property: making structural correctness
**load-bearing** rather than ceremonial. Rosetta is the surface where
domain experts compose against each other's vocabularies and get paid by
structure for it.

---

## Contributing a lexicon

See [`lexicons/README.md`](lexicons/README.md). Short version:

1. Author your domain lexicon as JSON matching the schema
2. PR it into `lexicons/`, OR `POST /lexicons` to a running server instance
3. Optional: mint as a Primitive NFT on VibeSwap (`PrimitiveRegistry.mint`)
   to bind authorship on-chain and become eligible for Shapley royalty
   attribution when translations cite your concepts

---

## License

MIT. See [LICENSE](LICENSE).
