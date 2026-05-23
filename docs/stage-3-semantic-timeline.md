# Stage 3: Semantic -> TimelineDraft

## Goal
Convert semantic input object into intermediate scene model (`TimelineDraft`).

## Implemented components
- `ReverieAdapter` (local draft adapter, contract-first)
- `TimelineDraftBuilder` (deterministic timeline assembly)
- `TimelineDraftsRepository` (Postgres persistence for drafts)
- API endpoints:
  - `POST /timeline-drafts`
  - `GET /timeline-drafts/examples`
  - `GET /timeline-drafts/:id`

## Contract layer (`packages/api`)
- `ReverieSemanticProject`
- `TimelineDraft`
- Validation: `validateReverieSemanticProject`
- Builder: `buildTimelineDraft`
- Examples: 3 use cases with expected timeline output

## Supported use cases
1. `hook`
2. `one-minute-script`
3. `social-post`

For each case:
- semantic input example exists,
- expected timeline exists,
- test validates generated timeline against expected shape.

## Product assumptions used
- Teleprompter scenes are supported via `mode: teleprompter`.
- Meme insert is represented with `mode: user-upload` + `tags: ["meme"]`.
- Hook default duration is 5 seconds unless explicit duration is provided.
- Draft is persisted immediately in Postgres for end-to-end checks.
- External ids for drafts/semantic flow are generated as UUIDv7.

## Database persistence
- New table: `timeline_drafts`
- Internal key: `id BIGSERIAL`
- External key: `external_id TEXT UNIQUE`
- Also stored:
  - `source_semantic_id`
  - `use_case`
  - `semantic_payload` (`JSONB`)
  - `draft_payload` (`JSONB`)

## Verification
- Contract tests in `packages/api/tests/timeline-contracts.test.ts`
- API tests in `apps/api/src/timeline/timeline.service.test.ts`
- Full workspace checks (`lint`, `typecheck`, `test`, `build`) are green.
