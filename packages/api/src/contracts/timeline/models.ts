export type SemanticUseCase = "hook" | "one-minute-script" | "social-post";

export type SemanticSceneMode = "ai-generated" | "teleprompter" | "user-upload";

export interface SemanticScene {
  id?: string;
  title: string;
  summary: string;
  text?: string;
  targetDurationMs?: number;
  mode?: SemanticSceneMode;
  tags?: string[];
}

export interface ReverieSemanticProject {
  semanticId?: string;
  useCase: SemanticUseCase;
  title: string;
  locale?: string;
  targetDurationMs?: number;
  scenes: SemanticScene[];
  globalInstructions?: string;
}

export type TimelineAssetStrategy =
  | "generate"
  | "record-upload"
  | "reuse-library";

export interface TimelineDraftScene {
  id: string;
  index: number;
  title: string;
  startMs: number;
  durationMs: number;
  mode: SemanticSceneMode;
  prompt: string;
  assetStrategy: TimelineAssetStrategy;
  tags: string[];
}

export interface TimelineDraftTrack {
  id: string;
  kind: "video" | "audio" | "subtitle";
  sceneIds: string[];
}

export interface TimelineDraft {
  draftId: string;
  sourceSemanticId: string;
  useCase: SemanticUseCase;
  totalDurationMs: number;
  scenes: TimelineDraftScene[];
  tracks: TimelineDraftTrack[];
  warnings: string[];
}

export interface TimelineCaseExample {
  id: SemanticUseCase;
  title: string;
  semanticProject: ReverieSemanticProject;
  expectedTimeline: TimelineDraft;
}
