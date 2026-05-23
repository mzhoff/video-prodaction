# Stage 2: API v1 (orchestration)

## What is implemented
- `POST /projects`
- `POST /render-jobs`
- `GET /render-jobs/:id`
- `GET /exports/:id`

Transport: REST (NestJS)
Storage: PostgreSQL

## Data model decisions
- Internal DB ids: `BIGSERIAL`.
- External ids (API-visible): `string` ids from contract; render job ids are generated as `UUIDv7`.
- API accepts stage-1 contracts from `@repo/api` and validates payloads at runtime.

## Status model
Render job lifecycle:
- `queued`
- `running`
- `done`
- `failed`

Prototype behavior:
- After creation, job is placed into `queued`.
- Background simulation moves it to `running`, then to `done`.
- If `exportPresetId` contains `fail`, simulation finalizes as `failed`.

## Error behavior
- Validation errors: `400` with `issues` list.
- Missing project or job: `404`.
- Duplicate project external id: `409`.
- Render failures are written into job/result structure:
  - `errorCode`
  - `errorMessage`

## API response behavior
- `POST /projects` returns saved `VideoProject`.
- `POST /render-jobs` returns created `RenderJob` in `queued` status.
- `GET /render-jobs/:id` returns current job state.
- `GET /exports/:id` returns:
  - `processing` if job is not finished,
  - `ready` with `downloadUrl` if render is done,
  - `failed` with error payload if render failed.

## Local run
1. Start local postgres:
   - `docker compose -f docker-compose.stage2.yml up -d`
2. Set env:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/video_prodaction`
3. Run API build/start:
   - `pnpm --filter api build`
   - `node apps/api/dist/apps/api/src/main.js`

## Verification
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Smoke run was executed against all 4 endpoints with real local Postgres.
