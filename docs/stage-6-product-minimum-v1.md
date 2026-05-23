# Stage 6: Product Minimum (v1.0)

## Goal
Ship a pilot-ready working version with end-to-end flow and minimum operational controls.

## Implemented

### 1) Final project structure + versions + export presets
- `ProjectsService` now supports:
  - project read,
  - version history listing,
  - version clone/create,
  - current version switch,
  - export preset append per version.
- New API endpoints:
  - `GET /projects/:id/versions`
  - `GET /projects/:id/versions/:versionId`
  - `POST /projects/:id/versions`
  - `PUT /projects/:id/current-version`
  - `POST /projects/:id/versions/:versionId/export-presets`

### 2) Access rights (editor / reader)
- Added request context middleware (`x-user-role`) with default `editor`.
- Added role guard + `@RequireRole()` decorator.
- Mutating endpoints require `editor`.
- Read endpoints allow `reader` or `editor`.

### 3) Logging and error dashboard
- Added global exception filter with normalized status responses.
- Added persistent error table: `system_error_logs`.
- Added ops endpoints:
  - `GET /ops/errors`
  - `GET /ops/errors/summary`

### 4) Pilot E2E workflow
- Added pilot orchestrator endpoint:
  - `GET /pilot/scenarios` (3 pilot scenarios)
  - `POST /pilot/runs` (`idea -> semantic -> timeline -> project -> render -> export status`)

### 5) Frontend v1.0 minimum additions
- Role selector (`editor/reader`) and role-aware requests.
- Project version/preset controls from UI.
- Ops error dashboard widget.

## Acceptance mapping
- `idea -> project -> render -> final file`: supported by `POST /pilot/runs`.
- 3 pilot scenarios: `hook`, `one-minute-script`, `social-post`.
- Critical errors: normalized status response + persisted error logs + dashboard API.
