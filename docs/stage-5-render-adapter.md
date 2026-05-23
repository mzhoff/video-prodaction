# Stage 5: Render Adapter

## Goal
Implement a first backend executor layer for render scenarios.

## What is implemented
- New `RenderPipelineAdapter` in API:
  - converts project version data into temporary render input format (`render-input.json`),
  - runs ffmpeg pipeline in local mode or docker container mode,
  - produces render artifacts and returns links for API result payload.

## Execution modes
`RENDER_PIPELINE_DRIVER` controls pipeline mode:
- `local` -> run local `ffmpeg`
- `container` -> run dockerized ffmpeg image
- `auto` (default) -> local first, then container fallback

Related env vars:
- `FFMPEG_BIN` (default: `ffmpeg`)
- `DOCKER_BIN` (default: `docker`)
- `RENDER_PIPELINE_IMAGE` (default: `jrottenberg/ffmpeg:6.0-ubuntu`)

## Deterministic storage
Artifacts are stored by deterministic path:
`artifacts/renders/<projectId>/<versionId>/<jobId>/`

Files generated:
- `<jobId>.mp4`
- `render-input.json`
- `pipeline.log`

## API linkage
- `RenderJobsService` now executes adapter in job lifecycle.
- On success:
  - job status -> `done`
  - `result.exportUrl` points to mp4 path
  - `result.artifacts` include video/timeline/log links
- API serves files via static route: `/artifacts/*`

## Base case expected output
For a valid project/version request, pipeline creates an mp4 file and returns export/artifact links in render result.
