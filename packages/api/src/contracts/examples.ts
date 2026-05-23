import type {
  RenderJob,
  RenderRequest,
  RenderResult,
  VideoProject,
} from "./models.js";

export const exampleVideoProject: VideoProject = {
  id: "project-001",
  name: "Promo: Summer Collection",
  description: "Video campaign for social media launch",
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:05:00.000Z",
  currentVersionId: "version-1",
  versions: [
    {
      id: "version-1",
      versionNumber: 1,
      createdAt: "2026-05-23T00:00:00.000Z",
      createdBy: "pm@video-action.local",
      notes: "Initial assembly from semantic script",
      scenes: [
        {
          id: "scene-1",
          title: "Hook",
          narration: "Open with product pain point",
          startMs: 0,
          durationMs: 6000,
          trackIds: ["track-video", "track-audio"],
          assetIds: ["asset-video-1", "asset-audio-1"],
          effectIds: ["effect-transition-1"],
        },
      ],
      tracks: [
        {
          id: "track-video",
          kind: "video",
          index: 0,
          clips: [
            {
              id: "clip-1",
              sceneId: "scene-1",
              assetId: "asset-video-1",
              effectIds: ["effect-transition-1"],
              startMs: 0,
              durationMs: 6000,
            },
          ],
        },
        {
          id: "track-audio",
          kind: "audio",
          index: 1,
          clips: [
            {
              id: "clip-2",
              sceneId: "scene-1",
              assetId: "asset-audio-1",
              startMs: 0,
              durationMs: 6000,
              effectIds: [],
            },
          ],
        },
      ],
      assets: [
        {
          id: "asset-video-1",
          kind: "video",
          sourceUrl: "https://cdn.video-action.local/assets/hook.mp4",
          durationMs: 6000,
        },
        {
          id: "asset-audio-1",
          kind: "audio",
          sourceUrl: "https://cdn.video-action.local/assets/voiceover.wav",
          durationMs: 6000,
        },
      ],
      effects: [
        {
          id: "effect-transition-1",
          kind: "transition",
          name: "Crossfade",
          params: {
            durationMs: 350,
          },
        },
      ],
      exportPresets: [
        {
          id: "preset-social-1080",
          name: "Social 1080p",
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          bitrateKbps: 8000,
          audioCodec: "aac",
        },
      ],
    },
  ],
};

export const exampleRenderRequest: RenderRequest = {
  requestId: "request-001",
  projectId: "project-001",
  projectVersionId: "version-1",
  exportPresetId: "preset-social-1080",
  requestedBy: "pm@video-action.local",
  requestedAt: "2026-05-23T00:06:00.000Z",
  priority: "high",
};

export const exampleRenderResultDone: RenderResult = {
  jobId: "job-001",
  status: "done",
  durationMs: 18200,
  exportUrl: "https://cdn.video-action.local/renders/job-001.mp4",
  artifacts: [
    {
      kind: "video",
      url: "https://cdn.video-action.local/renders/job-001.mp4",
    },
    {
      kind: "log",
      url: "https://cdn.video-action.local/renders/job-001.log",
    },
  ],
};

export const exampleRenderJobDone: RenderJob = {
  id: "job-001",
  projectId: "project-001",
  projectVersionId: "version-1",
  request: exampleRenderRequest,
  status: "done",
  attempts: 1,
  maxAttempts: 3,
  createdAt: "2026-05-23T00:06:05.000Z",
  updatedAt: "2026-05-23T00:06:30.000Z",
  startedAt: "2026-05-23T00:06:07.000Z",
  finishedAt: "2026-05-23T00:06:30.000Z",
  result: exampleRenderResultDone,
};

export const invalidVideoProjectExample: unknown = {
  id: "project-invalid",
  name: "Invalid project",
  createdAt: "invalid-date",
  updatedAt: "2026-05-23T00:05:00.000Z",
  currentVersionId: "version-missing",
  versions: [],
};
