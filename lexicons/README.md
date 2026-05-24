# Lexicons

Each `.json` file in this directory is a Rosetta lexicon: a structured concept
graph for a specific domain, ready to import into the engine via
`importLexicon()`.

## Schema

```json
{
  "id": "lowercase_snake_case",
  "domain": "Human-Readable Domain Name",
  "author_did": "did:key:z6Mk...",
  "concepts": {
    "concept_name": {
      "universal": "underlying_cross_domain_concept",
      "desc": "Plain-English explanation for a cross-domain reader."
    }
  }
}
```

## Contribution path

1. Author your lexicon as JSON matching the schema
2. POST to `/lexicons` on a Rosetta server instance, OR PR to this directory
3. Optional: mint as a Primitive NFT on VibeSwap PrimitiveRegistry (binds your authorship on-chain; enables Shapley royalty attribution when translations cite your concepts)

## Lexicons in this directory

- `oph.json` — Observer-Patch Holography concept graph (57 concepts). `author_did` is a placeholder pending Bernhard Mueller's signing key; rebind via `PUT /lexicons/oph/primitive` once the on-chain mint lands.
- *Add your lexicon here.*

## Cross-domain bridges

The power of Rosetta is in the cross-domain edges. When your lexicon includes
concepts that map to OPH primitives (observer_patch, mismatch, repair,
record, holonomy_defect) or to other published lexicons, the engine's
`composeLexicon` + `discoverEquivalent` operations route translations through
multiple hops automatically. Bernhard's OPH lexicon will function as a
load-bearing bridge between sociology, politics, economics, philosophy, and
math — drawing those edges already in his graph.
