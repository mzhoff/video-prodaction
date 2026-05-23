export type VideoAssetKind = "video" | "audio" | "image" | "text" | "template";

export type VideoTrackKind = "video" | "audio" | "subtitle" | "overlay";

export type VideoEffectKind = "transition" | "filter" | "animation" | "audio";

export type ExportFormat = "mp4" | "mov" | "webm";

export type ExportResolution = "720p" | "1080p" | "1440p" | "2160p";

export interface VideoAsset {
  id: string;
  kind: VideoAssetKind;
  sourceUrl: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface VideoEffect {
  id: string;
  kind: VideoEffectKind;
  name: string;
  params?: Record<string, string | number | boolean>;
}

export interface VideoClip {
  id: string;
  sceneId: string;
  assetId?: string;
  effectIds?: string[];
  startMs: number;
  durationMs: number;
}

export interface VideoTrack {
  id: string;
  kind: VideoTrackKind;
  index: number;
  clips: VideoClip[];
}

export interface VideoScene {
  id: string;
  title: string;
  narration?: string;
  startMs: number;
  durationMs: number;
  trackIds: string[];
  assetIds: string[];
  effectIds: string[];
}

export interface VideoExportPreset {
  id: string;
  name: string;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  bitrateKbps: number;
  audioCodec: "aac" | "pcm";
}

export interface VideoProjectVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  notes?: string;
  scenes: VideoScene[];
  tracks: VideoTrack[];
  assets: VideoAsset[];
  effects: VideoEffect[];
  exportPresets: VideoExportPreset[];
}

export interface VideoProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  versions: VideoProjectVersion[];
}

export type RenderPriority = "low" | "normal" | "high";

export interface RenderRequest {
  requestId: string;
  projectId: string;
  projectVersionId: string;
  exportPresetId: string;
  requestedBy: string;
  requestedAt: string;
  priority: RenderPriority;
}

export type RenderJobStatus = "queued" | "running" | "done" | "failed";

export interface RenderArtifact {
  kind: "log" | "timeline" | "video" | "thumbnail";
  url: string;
}

export interface RenderResult {
  jobId: string;
  status: "done" | "failed";
  durationMs: number;
  exportUrl?: string;
  artifacts: RenderArtifact[];
  errorCode?: string;
  errorMessage?: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  projectVersionId: string;
  request: RenderRequest;
  status: RenderJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: RenderResult;
}
