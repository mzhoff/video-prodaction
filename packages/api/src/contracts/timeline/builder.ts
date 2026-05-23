import { randomUUID } from "node:crypto";

import type {
  ReverieSemanticProject,
  SemanticScene,
  SemanticUseCase,
  TimelineAssetStrategy,
  TimelineDraft,
  TimelineDraftScene,
  TimelineDraftTrack,
} from "./models.js";

interface SceneDefaults {
  durationMs: number;
  mode: "ai-generated" | "teleprompter" | "user-upload";
  assetStrategy: TimelineAssetStrategy;
}

const DEFAULTS_BY_USE_CASE: Record<SemanticUseCase, SceneDefaults> = {
  hook: {
    durationMs: 5000,
    mode: "ai-generated",
    assetStrategy: "generate",
  },
  "one-minute-script": {
    durationMs: 10000,
    mode: "teleprompter",
    assetStrategy: "record-upload",
  },
  "social-post": {
    durationMs: 8000,
    mode: "ai-generated",
    assetStrategy: "generate",
  },
};

const fallbackTagsByUseCase = (useCase: SemanticUseCase): string[] => {
  if (useCase === "hook") {
    return ["hook", "attention"];
  }

  if (useCase === "one-minute-script") {
    return ["script", "teleprompter"];
  }

  return ["social", "short-form"];
};

const sceneModeFromInput = (
  scene: SemanticScene,
  useCase: SemanticUseCase,
): "ai-generated" | "teleprompter" | "user-upload" => {
  if (scene.mode) {
    return scene.mode;
  }

  return DEFAULTS_BY_USE_CASE[useCase].mode;
};

const sceneStrategyFromMode = (
  mode: "ai-generated" | "teleprompter" | "user-upload",
): TimelineAssetStrategy => {
  if (mode === "teleprompter") {
    return "record-upload";
  }

  if (mode === "user-upload") {
    return "reuse-library";
  }

  return "generate";
};

const buildPrompt = (
  semanticProject: ReverieSemanticProject,
  scene: SemanticScene,
  mode: "ai-generated" | "teleprompter" | "user-upload",
): string => {
  const base = `${scene.summary}.`;

  if (mode === "teleprompter") {
    return [
      `Deliver script for scene: ${scene.title}.`,
      scene.text ? `Text: ${scene.text}` : `Goal: ${base}`,
      semanticProject.globalInstructions
        ? `Global: ${semanticProject.globalInstructions}`
        : "",
    ]
      .filter((part) => part.length > 0)
      .join(" ");
  }

  return [
    `Generate visual scene: ${scene.title}.`,
    `Narrative: ${scene.text ?? base}`,
    semanticProject.globalInstructions
      ? `Global: ${semanticProject.globalInstructions}`
      : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
};

export const buildTimelineDraft = (
  semanticProject: ReverieSemanticProject,
): TimelineDraft => {
  const draftId = randomUUID();
  const semanticId = semanticProject.semanticId ?? randomUUID();
  const warnings: string[] = [];

  const scenes: TimelineDraftScene[] = [];
  let cursorMs = 0;

  semanticProject.scenes.forEach((scene, index) => {
    const defaultConfig = DEFAULTS_BY_USE_CASE[semanticProject.useCase];
    const durationMs = scene.targetDurationMs ?? defaultConfig.durationMs;
    const mode = sceneModeFromInput(scene, semanticProject.useCase);
    const assetStrategy =
      mode === scene.mode
        ? sceneStrategyFromMode(mode)
        : defaultConfig.assetStrategy;

    if (durationMs < 3000) {
      warnings.push(
        `Scene '${scene.title}' has very short duration (${durationMs}ms).`,
      );
    }

    const tags =
      scene.tags && scene.tags.length > 0
        ? [...scene.tags]
        : fallbackTagsByUseCase(semanticProject.useCase);

    scenes.push({
      id: scene.id ?? `scene-${index + 1}`,
      index,
      title: scene.title,
      startMs: cursorMs,
      durationMs,
      mode,
      prompt: buildPrompt(semanticProject, scene, mode),
      assetStrategy,
      tags,
    });

    cursorMs += durationMs;
  });

  if (
    semanticProject.targetDurationMs &&
    Math.abs(cursorMs - semanticProject.targetDurationMs) > 5000
  ) {
    warnings.push(
      `Timeline duration (${cursorMs}ms) differs from target (${semanticProject.targetDurationMs}ms).`,
    );
  }

  const tracks: TimelineDraftTrack[] = [
    {
      id: "track-video",
      kind: "video",
      sceneIds: scenes.map((scene) => scene.id),
    },
    {
      id: "track-audio",
      kind: "audio",
      sceneIds: scenes.map((scene) => scene.id),
    },
  ];

  if (scenes.some((scene) => scene.mode === "teleprompter")) {
    tracks.push({
      id: "track-subtitle",
      kind: "subtitle",
      sceneIds: scenes.map((scene) => scene.id),
    });
  }

  return {
    draftId,
    sourceSemanticId: semanticId,
    useCase: semanticProject.useCase,
    totalDurationMs: cursorMs,
    scenes,
    tracks,
    warnings,
  };
};
