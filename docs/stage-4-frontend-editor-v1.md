# Stage 4: Frontend Editor v1 (timeline + presets)

## Goal
Give operator a basic editor to adjust structure before render.

## What was implemented
- New web editor screen in `apps/web/src/app/page.tsx`.
- Scene list with editable fields:
  - title,
  - narration/text,
  - duration,
  - transition preset.
- Basic summary and preview metrics:
  - scene count,
  - total duration,
  - transition distribution.
- Action button `Запустить сборку`.

## End-to-end flow
1. Operator edits scene structure in UI.
2. UI builds a `VideoProject` contract and sends `POST /projects`.
3. UI verifies saved project via `GET /projects/:id`.
4. UI sends `POST /render-jobs`.
5. UI polls `GET /render-jobs/:id` and then reads `GET /exports/:id`.

## API updates for editor
- Added `GET /projects/:id` to read project from API.
- Enabled CORS in API bootstrap for local web->api calls.

## Notes
- Track model uses separate track kinds (`video`, `audio`, `subtitle`) for future montage expansion.
- UI creates valid placeholder assets/effects so contracts pass validation and render orchestration can start.
