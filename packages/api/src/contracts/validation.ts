import type {
  RenderArtifact,
  RenderJob,
  RenderJobStatus,
  RenderPriority,
  RenderRequest,
  RenderResult,
  VideoAsset,
  VideoAssetKind,
  VideoClip,
  VideoEffect,
  VideoEffectKind,
  VideoExportPreset,
  VideoProject,
  VideoProjectVersion,
  VideoScene,
  VideoTrack,
  VideoTrackKind,
} from "./models.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const VIDEO_ASSET_KINDS: VideoAssetKind[] = [
  "video",
  "audio",
  "image",
  "text",
  "template",
];
const VIDEO_TRACK_KINDS: VideoTrackKind[] = [
  "video",
  "audio",
  "subtitle",
  "overlay",
];
const VIDEO_EFFECT_KINDS: VideoEffectKind[] = [
  "transition",
  "filter",
  "animation",
  "audio",
];
const EXPORT_FORMATS = ["mp4", "mov", "webm"] as const;
const EXPORT_RESOLUTIONS = ["720p", "1080p", "1440p", "2160p"] as const;
const RENDER_PRIORITIES: RenderPriority[] = ["low", "normal", "high"];
const RENDER_JOB_STATUSES: RenderJobStatus[] = [
  "queued",
  "running",
  "done",
  "failed",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

const isIsoDateTime = (value: unknown): value is string =>
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value));

const isHttpUrl = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const includesValue = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T => typeof value === "string" && list.includes(value as T);

const pushIssue = (
  issues: ValidationIssue[],
  path: string,
  message: string,
): void => {
  issues.push({ path, message });
};

const validateStringArray = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): string[] => {
  if (!Array.isArray(value)) {
    pushIssue(issues, path, "must be an array");
    return [];
  }

  const result: string[] = [];
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      pushIssue(issues, `${path}[${index}]`, "must be a non-empty string");
      return;
    }

    result.push(item);
  });

  return result;
};

const validateStringRecord = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): Record<string, string | number | boolean> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const result: Record<string, string | number | boolean> = {};
  Object.entries(value).forEach(([key, item]) => {
    if (
      typeof item !== "string" &&
      typeof item !== "number" &&
      typeof item !== "boolean"
    ) {
      pushIssue(issues, `${path}.${key}`, "must be string, number, or boolean");
      return;
    }

    result[key] = item;
  });

  return result;
};

const validateAsset = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoAsset | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const kind = value.kind;
  const sourceUrl = value.sourceUrl;
  const durationMs = value.durationMs;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!includesValue(VIDEO_ASSET_KINDS, kind)) {
    pushIssue(issues, `${path}.kind`, "has unsupported asset kind");
  }
  if (!isHttpUrl(sourceUrl)) {
    pushIssue(issues, `${path}.sourceUrl`, "must be a valid http/https URL");
  }
  if (durationMs !== undefined && !isNonNegativeNumber(durationMs)) {
    pushIssue(issues, `${path}.durationMs`, "must be a non-negative number");
  }

  const metadata = validateStringRecord(
    value.metadata,
    `${path}.metadata`,
    issues,
  );

  if (
    !isNonEmptyString(id) ||
    !includesValue(VIDEO_ASSET_KINDS, kind) ||
    !isHttpUrl(sourceUrl)
  ) {
    return undefined;
  }

  return {
    id,
    kind,
    sourceUrl,
    durationMs: isNonNegativeNumber(durationMs) ? durationMs : undefined,
    metadata,
  };
};

const validateEffect = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoEffect | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const kind = value.kind;
  const name = value.name;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!includesValue(VIDEO_EFFECT_KINDS, kind)) {
    pushIssue(issues, `${path}.kind`, "has unsupported effect kind");
  }
  if (!isNonEmptyString(name)) {
    pushIssue(issues, `${path}.name`, "must be a non-empty string");
  }

  const params = validateStringRecord(value.params, `${path}.params`, issues);

  if (
    !isNonEmptyString(id) ||
    !includesValue(VIDEO_EFFECT_KINDS, kind) ||
    !isNonEmptyString(name)
  ) {
    return undefined;
  }

  return {
    id,
    kind,
    name,
    params,
  };
};

const validateClip = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoClip | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const sceneId = value.sceneId;
  const assetId = value.assetId;
  const startMs = value.startMs;
  const durationMs = value.durationMs;
  const effectIds = validateStringArray(
    value.effectIds ?? [],
    `${path}.effectIds`,
    issues,
  );

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!isNonEmptyString(sceneId)) {
    pushIssue(issues, `${path}.sceneId`, "must be a non-empty string");
  }
  if (assetId !== undefined && !isNonEmptyString(assetId)) {
    pushIssue(
      issues,
      `${path}.assetId`,
      "must be a non-empty string when provided",
    );
  }
  if (!isNonNegativeNumber(startMs)) {
    pushIssue(issues, `${path}.startMs`, "must be a non-negative number");
  }
  if (!isNonNegativeNumber(durationMs) || durationMs === 0) {
    pushIssue(issues, `${path}.durationMs`, "must be a number greater than 0");
  }

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(sceneId) ||
    !isNonNegativeNumber(startMs) ||
    !isNonNegativeNumber(durationMs) ||
    durationMs === 0
  ) {
    return undefined;
  }

  return {
    id,
    sceneId,
    assetId: isNonEmptyString(assetId) ? assetId : undefined,
    effectIds,
    startMs,
    durationMs,
  };
};

const validateTrack = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoTrack | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const kind = value.kind;
  const index = value.index;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!includesValue(VIDEO_TRACK_KINDS, kind)) {
    pushIssue(issues, `${path}.kind`, "has unsupported track kind");
  }
  if (!Number.isInteger(index) || (index as number) < 0) {
    pushIssue(issues, `${path}.index`, "must be a non-negative integer");
  }

  const clipsInput = value.clips;
  if (!Array.isArray(clipsInput)) {
    pushIssue(issues, `${path}.clips`, "must be an array");
  }

  const clips: VideoClip[] = [];
  if (Array.isArray(clipsInput)) {
    clipsInput.forEach((clip, clipIndex) => {
      const parsed = validateClip(clip, `${path}.clips[${clipIndex}]`, issues);
      if (parsed) {
        clips.push(parsed);
      }
    });
  }

  if (
    !isNonEmptyString(id) ||
    !includesValue(VIDEO_TRACK_KINDS, kind) ||
    !Number.isInteger(index) ||
    (index as number) < 0
  ) {
    return undefined;
  }

  return {
    id,
    kind,
    index: index as number,
    clips,
  };
};

const validateScene = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoScene | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const title = value.title;
  const startMs = value.startMs;
  const durationMs = value.durationMs;
  const narration = value.narration;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!isNonEmptyString(title)) {
    pushIssue(issues, `${path}.title`, "must be a non-empty string");
  }
  if (!isNonNegativeNumber(startMs)) {
    pushIssue(issues, `${path}.startMs`, "must be a non-negative number");
  }
  if (!isNonNegativeNumber(durationMs) || durationMs === 0) {
    pushIssue(issues, `${path}.durationMs`, "must be a number greater than 0");
  }
  if (narration !== undefined && !isNonEmptyString(narration)) {
    pushIssue(
      issues,
      `${path}.narration`,
      "must be a non-empty string when provided",
    );
  }

  const trackIds = validateStringArray(
    value.trackIds,
    `${path}.trackIds`,
    issues,
  );
  const assetIds = validateStringArray(
    value.assetIds,
    `${path}.assetIds`,
    issues,
  );
  const effectIds = validateStringArray(
    value.effectIds,
    `${path}.effectIds`,
    issues,
  );

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(title) ||
    !isNonNegativeNumber(startMs) ||
    !isNonNegativeNumber(durationMs) ||
    durationMs === 0
  ) {
    return undefined;
  }

  return {
    id,
    title,
    narration: isNonEmptyString(narration) ? narration : undefined,
    startMs,
    durationMs,
    trackIds,
    assetIds,
    effectIds,
  };
};

const validateExportPreset = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoExportPreset | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const name = value.name;
  const format = value.format;
  const resolution = value.resolution;
  const fps = value.fps;
  const bitrateKbps = value.bitrateKbps;
  const audioCodec = value.audioCodec;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!isNonEmptyString(name)) {
    pushIssue(issues, `${path}.name`, "must be a non-empty string");
  }
  if (!includesValue(EXPORT_FORMATS, format)) {
    pushIssue(issues, `${path}.format`, "has unsupported export format");
  }
  if (!includesValue(EXPORT_RESOLUTIONS, resolution)) {
    pushIssue(
      issues,
      `${path}.resolution`,
      "has unsupported export resolution",
    );
  }
  if (!isPositiveInteger(fps)) {
    pushIssue(issues, `${path}.fps`, "must be a positive integer");
  }
  if (!isPositiveInteger(bitrateKbps)) {
    pushIssue(issues, `${path}.bitrateKbps`, "must be a positive integer");
  }
  if (audioCodec !== "aac" && audioCodec !== "pcm") {
    pushIssue(issues, `${path}.audioCodec`, "must be either 'aac' or 'pcm'");
  }

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(name) ||
    !includesValue(EXPORT_FORMATS, format) ||
    !includesValue(EXPORT_RESOLUTIONS, resolution) ||
    !isPositiveInteger(fps) ||
    !isPositiveInteger(bitrateKbps) ||
    (audioCodec !== "aac" && audioCodec !== "pcm")
  ) {
    return undefined;
  }

  return {
    id,
    name,
    format,
    resolution,
    fps,
    bitrateKbps,
    audioCodec,
  };
};

const validateVersion = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): VideoProjectVersion | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const id = value.id;
  const versionNumber = value.versionNumber;
  const createdAt = value.createdAt;
  const createdBy = value.createdBy;
  const notes = value.notes;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, `${path}.id`, "must be a non-empty string");
  }
  if (!isPositiveInteger(versionNumber)) {
    pushIssue(issues, `${path}.versionNumber`, "must be a positive integer");
  }
  if (!isIsoDateTime(createdAt)) {
    pushIssue(issues, `${path}.createdAt`, "must be an ISO date-time string");
  }
  if (!isNonEmptyString(createdBy)) {
    pushIssue(issues, `${path}.createdBy`, "must be a non-empty string");
  }
  if (notes !== undefined && !isNonEmptyString(notes)) {
    pushIssue(
      issues,
      `${path}.notes`,
      "must be a non-empty string when provided",
    );
  }

  const scenesInput = value.scenes;
  const tracksInput = value.tracks;
  const assetsInput = value.assets;
  const effectsInput = value.effects;
  const exportPresetsInput = value.exportPresets;

  if (!Array.isArray(scenesInput)) {
    pushIssue(issues, `${path}.scenes`, "must be an array");
  }
  if (!Array.isArray(tracksInput)) {
    pushIssue(issues, `${path}.tracks`, "must be an array");
  }
  if (!Array.isArray(assetsInput)) {
    pushIssue(issues, `${path}.assets`, "must be an array");
  }
  if (!Array.isArray(effectsInput)) {
    pushIssue(issues, `${path}.effects`, "must be an array");
  }
  if (!Array.isArray(exportPresetsInput)) {
    pushIssue(issues, `${path}.exportPresets`, "must be an array");
  }

  const scenes: VideoScene[] = [];
  if (Array.isArray(scenesInput)) {
    scenesInput.forEach((scene, index) => {
      const parsed = validateScene(scene, `${path}.scenes[${index}]`, issues);
      if (parsed) {
        scenes.push(parsed);
      }
    });
  }

  const tracks: VideoTrack[] = [];
  if (Array.isArray(tracksInput)) {
    tracksInput.forEach((track, index) => {
      const parsed = validateTrack(track, `${path}.tracks[${index}]`, issues);
      if (parsed) {
        tracks.push(parsed);
      }
    });
  }

  const assets: VideoAsset[] = [];
  if (Array.isArray(assetsInput)) {
    assetsInput.forEach((asset, index) => {
      const parsed = validateAsset(asset, `${path}.assets[${index}]`, issues);
      if (parsed) {
        assets.push(parsed);
      }
    });
  }

  const effects: VideoEffect[] = [];
  if (Array.isArray(effectsInput)) {
    effectsInput.forEach((effect, index) => {
      const parsed = validateEffect(
        effect,
        `${path}.effects[${index}]`,
        issues,
      );
      if (parsed) {
        effects.push(parsed);
      }
    });
  }

  const exportPresets: VideoExportPreset[] = [];
  if (Array.isArray(exportPresetsInput)) {
    exportPresetsInput.forEach((preset, index) => {
      const parsed = validateExportPreset(
        preset,
        `${path}.exportPresets[${index}]`,
        issues,
      );
      if (parsed) {
        exportPresets.push(parsed);
      }
    });
  }

  const trackIds = new Set(tracks.map((track) => track.id));
  const assetIds = new Set(assets.map((asset) => asset.id));
  const effectIds = new Set(effects.map((effect) => effect.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));

  scenes.forEach((scene, sceneIndex) => {
    scene.trackIds.forEach((trackId) => {
      if (!trackIds.has(trackId)) {
        pushIssue(
          issues,
          `${path}.scenes[${sceneIndex}].trackIds`,
          `unknown track id '${trackId}'`,
        );
      }
    });

    scene.assetIds.forEach((assetId) => {
      if (!assetIds.has(assetId)) {
        pushIssue(
          issues,
          `${path}.scenes[${sceneIndex}].assetIds`,
          `unknown asset id '${assetId}'`,
        );
      }
    });

    scene.effectIds.forEach((effectId) => {
      if (!effectIds.has(effectId)) {
        pushIssue(
          issues,
          `${path}.scenes[${sceneIndex}].effectIds`,
          `unknown effect id '${effectId}'`,
        );
      }
    });
  });

  tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip, clipIndex) => {
      if (!sceneIds.has(clip.sceneId)) {
        pushIssue(
          issues,
          `${path}.tracks[${trackIndex}].clips[${clipIndex}].sceneId`,
          `unknown scene id '${clip.sceneId}'`,
        );
      }

      if (clip.assetId && !assetIds.has(clip.assetId)) {
        pushIssue(
          issues,
          `${path}.tracks[${trackIndex}].clips[${clipIndex}].assetId`,
          `unknown asset id '${clip.assetId}'`,
        );
      }

      (clip.effectIds ?? []).forEach((effectId) => {
        if (!effectIds.has(effectId)) {
          pushIssue(
            issues,
            `${path}.tracks[${trackIndex}].clips[${clipIndex}].effectIds`,
            `unknown effect id '${effectId}'`,
          );
        }
      });
    });
  });

  if (
    !isNonEmptyString(id) ||
    !isPositiveInteger(versionNumber) ||
    !isIsoDateTime(createdAt) ||
    !isNonEmptyString(createdBy)
  ) {
    return undefined;
  }

  return {
    id,
    versionNumber,
    createdAt,
    createdBy,
    notes: isNonEmptyString(notes) ? notes : undefined,
    scenes,
    tracks,
    assets,
    effects,
    exportPresets,
  };
};

export const validateVideoProject = (
  value: unknown,
): ValidationResult<VideoProject> => {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ path: "videoProject", message: "must be an object" }],
    };
  }

  const id = value.id;
  const name = value.name;
  const description = value.description;
  const createdAt = value.createdAt;
  const updatedAt = value.updatedAt;
  const currentVersionId = value.currentVersionId;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, "videoProject.id", "must be a non-empty string");
  }
  if (!isNonEmptyString(name)) {
    pushIssue(issues, "videoProject.name", "must be a non-empty string");
  }
  if (description !== undefined && !isNonEmptyString(description)) {
    pushIssue(
      issues,
      "videoProject.description",
      "must be a non-empty string when provided",
    );
  }
  if (!isIsoDateTime(createdAt)) {
    pushIssue(
      issues,
      "videoProject.createdAt",
      "must be an ISO date-time string",
    );
  }
  if (!isIsoDateTime(updatedAt)) {
    pushIssue(
      issues,
      "videoProject.updatedAt",
      "must be an ISO date-time string",
    );
  }
  if (!isNonEmptyString(currentVersionId)) {
    pushIssue(
      issues,
      "videoProject.currentVersionId",
      "must be a non-empty string",
    );
  }

  const versionsInput = value.versions;
  if (!Array.isArray(versionsInput)) {
    pushIssue(issues, "videoProject.versions", "must be an array");
  }

  const versions: VideoProjectVersion[] = [];
  if (Array.isArray(versionsInput)) {
    versionsInput.forEach((version, index) => {
      const parsed = validateVersion(
        version,
        `videoProject.versions[${index}]`,
        issues,
      );
      if (parsed) {
        versions.push(parsed);
      }
    });
  }

  if (isNonEmptyString(currentVersionId)) {
    const knownVersionIds = new Set(versions.map((version) => version.id));
    if (!knownVersionIds.has(currentVersionId)) {
      pushIssue(
        issues,
        "videoProject.currentVersionId",
        "must reference an existing version id",
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      id: id as string,
      name: name as string,
      description: isNonEmptyString(description) ? description : undefined,
      createdAt: createdAt as string,
      updatedAt: updatedAt as string,
      currentVersionId: currentVersionId as string,
      versions,
    },
  };
};

export const validateRenderRequest = (
  value: unknown,
): ValidationResult<RenderRequest> => {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ path: "renderRequest", message: "must be an object" }],
    };
  }

  const requestId = value.requestId;
  const projectId = value.projectId;
  const projectVersionId = value.projectVersionId;
  const exportPresetId = value.exportPresetId;
  const requestedBy = value.requestedBy;
  const requestedAt = value.requestedAt;
  const priority = value.priority;

  if (!isNonEmptyString(requestId)) {
    pushIssue(issues, "renderRequest.requestId", "must be a non-empty string");
  }
  if (!isNonEmptyString(projectId)) {
    pushIssue(issues, "renderRequest.projectId", "must be a non-empty string");
  }
  if (!isNonEmptyString(projectVersionId)) {
    pushIssue(
      issues,
      "renderRequest.projectVersionId",
      "must be a non-empty string",
    );
  }
  if (!isNonEmptyString(exportPresetId)) {
    pushIssue(
      issues,
      "renderRequest.exportPresetId",
      "must be a non-empty string",
    );
  }
  if (!isNonEmptyString(requestedBy)) {
    pushIssue(
      issues,
      "renderRequest.requestedBy",
      "must be a non-empty string",
    );
  }
  if (!isIsoDateTime(requestedAt)) {
    pushIssue(
      issues,
      "renderRequest.requestedAt",
      "must be an ISO date-time string",
    );
  }
  if (!includesValue(RENDER_PRIORITIES, priority)) {
    pushIssue(
      issues,
      "renderRequest.priority",
      "must be one of: low, normal, high",
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      requestId,
      projectId,
      projectVersionId,
      exportPresetId,
      requestedBy,
      requestedAt,
      priority,
    } as RenderRequest,
  };
};

const validateArtifact = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): RenderArtifact | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const kind = value.kind;
  const url = value.url;
  const allowedKinds: RenderArtifact["kind"][] = [
    "log",
    "timeline",
    "video",
    "thumbnail",
  ];

  if (!includesValue(allowedKinds, kind)) {
    pushIssue(issues, `${path}.kind`, "has unsupported artifact kind");
  }
  if (!isHttpUrl(url)) {
    pushIssue(issues, `${path}.url`, "must be a valid http/https URL");
  }

  if (!includesValue(allowedKinds, kind) || !isHttpUrl(url)) {
    return undefined;
  }

  return { kind, url };
};

export const validateRenderResult = (
  value: unknown,
): ValidationResult<RenderResult> => {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ path: "renderResult", message: "must be an object" }],
    };
  }

  const jobId = value.jobId;
  const status = value.status;
  const durationMs = value.durationMs;
  const exportUrl = value.exportUrl;
  const artifactsInput = value.artifacts;
  const errorCode = value.errorCode;
  const errorMessage = value.errorMessage;

  if (!isNonEmptyString(jobId)) {
    pushIssue(issues, "renderResult.jobId", "must be a non-empty string");
  }
  if (status !== "done" && status !== "failed") {
    pushIssue(issues, "renderResult.status", "must be 'done' or 'failed'");
  }
  if (!isNonNegativeNumber(durationMs)) {
    pushIssue(
      issues,
      "renderResult.durationMs",
      "must be a non-negative number",
    );
  }
  if (exportUrl !== undefined && !isHttpUrl(exportUrl)) {
    pushIssue(
      issues,
      "renderResult.exportUrl",
      "must be a valid http/https URL",
    );
  }

  if (!Array.isArray(artifactsInput)) {
    pushIssue(issues, "renderResult.artifacts", "must be an array");
  }

  const artifacts: RenderArtifact[] = [];
  if (Array.isArray(artifactsInput)) {
    artifactsInput.forEach((artifact, index) => {
      const parsed = validateArtifact(
        artifact,
        `renderResult.artifacts[${index}]`,
        issues,
      );
      if (parsed) {
        artifacts.push(parsed);
      }
    });
  }

  if (status === "failed") {
    if (!isNonEmptyString(errorCode)) {
      pushIssue(
        issues,
        "renderResult.errorCode",
        "must be present when status is 'failed'",
      );
    }
    if (!isNonEmptyString(errorMessage)) {
      pushIssue(
        issues,
        "renderResult.errorMessage",
        "must be present when status is 'failed'",
      );
    }
  }

  if (status === "done" && !isHttpUrl(exportUrl)) {
    pushIssue(
      issues,
      "renderResult.exportUrl",
      "must be present when status is 'done'",
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      jobId,
      status,
      durationMs,
      exportUrl,
      artifacts,
      errorCode,
      errorMessage,
    } as RenderResult,
  };
};

export const validateRenderJob = (
  value: unknown,
): ValidationResult<RenderJob> => {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ path: "renderJob", message: "must be an object" }],
    };
  }

  const id = value.id;
  const projectId = value.projectId;
  const projectVersionId = value.projectVersionId;
  const status = value.status;
  const attempts = value.attempts;
  const maxAttempts = value.maxAttempts;
  const createdAt = value.createdAt;
  const updatedAt = value.updatedAt;
  const startedAt = value.startedAt;
  const finishedAt = value.finishedAt;

  if (!isNonEmptyString(id)) {
    pushIssue(issues, "renderJob.id", "must be a non-empty string");
  }
  if (!isNonEmptyString(projectId)) {
    pushIssue(issues, "renderJob.projectId", "must be a non-empty string");
  }
  if (!isNonEmptyString(projectVersionId)) {
    pushIssue(
      issues,
      "renderJob.projectVersionId",
      "must be a non-empty string",
    );
  }
  if (!includesValue(RENDER_JOB_STATUSES, status)) {
    pushIssue(
      issues,
      "renderJob.status",
      "must be one of: queued, running, done, failed",
    );
  }
  if (!Number.isInteger(attempts) || (attempts as number) < 0) {
    pushIssue(issues, "renderJob.attempts", "must be a non-negative integer");
  }
  if (!isPositiveInteger(maxAttempts)) {
    pushIssue(issues, "renderJob.maxAttempts", "must be a positive integer");
  }
  if (!isIsoDateTime(createdAt)) {
    pushIssue(issues, "renderJob.createdAt", "must be an ISO date-time string");
  }
  if (!isIsoDateTime(updatedAt)) {
    pushIssue(issues, "renderJob.updatedAt", "must be an ISO date-time string");
  }
  if (startedAt !== undefined && !isIsoDateTime(startedAt)) {
    pushIssue(issues, "renderJob.startedAt", "must be an ISO date-time string");
  }
  if (finishedAt !== undefined && !isIsoDateTime(finishedAt)) {
    pushIssue(
      issues,
      "renderJob.finishedAt",
      "must be an ISO date-time string",
    );
  }

  const requestValidation = validateRenderRequest(value.request);
  if (!requestValidation.ok) {
    requestValidation.issues.forEach((issue) => {
      pushIssue(issues, `renderJob.request.${issue.path}`, issue.message);
    });
  }

  let parsedResult: RenderResult | undefined;
  if (value.result !== undefined) {
    const resultValidation = validateRenderResult(value.result);
    if (!resultValidation.ok) {
      resultValidation.issues.forEach((issue) => {
        pushIssue(issues, `renderJob.result.${issue.path}`, issue.message);
      });
    } else {
      parsedResult = resultValidation.value;
    }
  }

  if (status === "done" && !parsedResult) {
    pushIssue(
      issues,
      "renderJob.result",
      "must be provided when status is 'done'",
    );
  }

  if (status === "failed" && !parsedResult) {
    pushIssue(
      issues,
      "renderJob.result",
      "must be provided when status is 'failed'",
    );
  }

  if (issues.length > 0 || !requestValidation.ok) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      id,
      projectId,
      projectVersionId,
      request: requestValidation.value,
      status,
      attempts,
      maxAttempts,
      createdAt,
      updatedAt,
      startedAt,
      finishedAt,
      result: parsedResult,
    } as RenderJob,
  };
};
