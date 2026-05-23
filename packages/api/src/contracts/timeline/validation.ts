import type {
  ReverieSemanticProject,
  SemanticScene,
  SemanticSceneMode,
  SemanticUseCase,
} from "./models.js";

export interface TimelineValidationIssue {
  path: string;
  message: string;
}

export type TimelineValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: TimelineValidationIssue[] };

const SCENE_MODES: SemanticSceneMode[] = [
  "ai-generated",
  "teleprompter",
  "user-upload",
];

const USE_CASES: SemanticUseCase[] = [
  "hook",
  "one-minute-script",
  "social-post",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const includesValue = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T => typeof value === "string" && list.includes(value as T);

const pushIssue = (
  issues: TimelineValidationIssue[],
  path: string,
  message: string,
): void => {
  issues.push({ path, message });
};

const validateTags = (
  value: unknown,
  path: string,
  issues: TimelineValidationIssue[],
): string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    pushIssue(issues, path, "must be an array of strings");
    return [];
  }

  const tags: string[] = [];
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      pushIssue(issues, `${path}[${index}]`, "must be a non-empty string");
      return;
    }

    tags.push(item);
  });

  return tags;
};

const validateScene = (
  value: unknown,
  path: string,
  issues: TimelineValidationIssue[],
): SemanticScene | undefined => {
  if (!isObject(value)) {
    pushIssue(issues, path, "must be an object");
    return undefined;
  }

  const title = value.title;
  const summary = value.summary;
  const text = value.text;
  const targetDurationMs = value.targetDurationMs;
  const mode = value.mode;

  if (!isNonEmptyString(title)) {
    pushIssue(issues, `${path}.title`, "must be a non-empty string");
  }

  if (!isNonEmptyString(summary)) {
    pushIssue(issues, `${path}.summary`, "must be a non-empty string");
  }

  if (text !== undefined && !isNonEmptyString(text)) {
    pushIssue(
      issues,
      `${path}.text`,
      "must be a non-empty string when provided",
    );
  }

  if (targetDurationMs !== undefined && !isPositiveNumber(targetDurationMs)) {
    pushIssue(
      issues,
      `${path}.targetDurationMs`,
      "must be a positive number when provided",
    );
  }

  if (mode !== undefined && !includesValue(SCENE_MODES, mode)) {
    pushIssue(
      issues,
      `${path}.mode`,
      "must be one of: ai-generated, teleprompter, user-upload",
    );
  }

  const tags = validateTags(value.tags, `${path}.tags`, issues);

  if (!isNonEmptyString(title) || !isNonEmptyString(summary)) {
    return undefined;
  }

  return {
    id: isNonEmptyString(value.id) ? value.id : undefined,
    title,
    summary,
    text: isNonEmptyString(text) ? text : undefined,
    targetDurationMs: isPositiveNumber(targetDurationMs)
      ? targetDurationMs
      : undefined,
    mode: includesValue(SCENE_MODES, mode) ? mode : undefined,
    tags,
  };
};

export const validateReverieSemanticProject = (
  value: unknown,
): TimelineValidationResult<ReverieSemanticProject> => {
  const issues: TimelineValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ path: "semanticProject", message: "must be an object" }],
    };
  }

  const useCase = value.useCase;
  const title = value.title;
  const locale = value.locale;
  const targetDurationMs = value.targetDurationMs;
  const globalInstructions = value.globalInstructions;

  if (!includesValue(USE_CASES, useCase)) {
    pushIssue(
      issues,
      "semanticProject.useCase",
      "must be one of: hook, one-minute-script, social-post",
    );
  }

  if (!isNonEmptyString(title)) {
    pushIssue(issues, "semanticProject.title", "must be a non-empty string");
  }

  if (locale !== undefined && !isNonEmptyString(locale)) {
    pushIssue(
      issues,
      "semanticProject.locale",
      "must be a non-empty string when provided",
    );
  }

  if (targetDurationMs !== undefined && !isPositiveNumber(targetDurationMs)) {
    pushIssue(
      issues,
      "semanticProject.targetDurationMs",
      "must be a positive number when provided",
    );
  }

  if (
    globalInstructions !== undefined &&
    !isNonEmptyString(globalInstructions)
  ) {
    pushIssue(
      issues,
      "semanticProject.globalInstructions",
      "must be a non-empty string when provided",
    );
  }

  if (!Array.isArray(value.scenes)) {
    pushIssue(issues, "semanticProject.scenes", "must be an array");
  }

  const scenes: SemanticScene[] = [];
  if (Array.isArray(value.scenes)) {
    value.scenes.forEach((scene, index) => {
      const parsed = validateScene(
        scene,
        `semanticProject.scenes[${index}]`,
        issues,
      );
      if (parsed) {
        scenes.push(parsed);
      }
    });
  }

  if (scenes.length === 0) {
    pushIssue(
      issues,
      "semanticProject.scenes",
      "must contain at least one valid scene",
    );
  }

  if (
    issues.length > 0 ||
    !includesValue(USE_CASES, useCase) ||
    !isNonEmptyString(title)
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      semanticId: isNonEmptyString(value.semanticId)
        ? value.semanticId
        : undefined,
      useCase,
      title,
      locale: isNonEmptyString(locale) ? locale : undefined,
      targetDurationMs: isPositiveNumber(targetDurationMs)
        ? targetDurationMs
        : undefined,
      scenes,
      globalInstructions: isNonEmptyString(globalInstructions)
        ? globalInstructions
        : undefined,
    },
  };
};
