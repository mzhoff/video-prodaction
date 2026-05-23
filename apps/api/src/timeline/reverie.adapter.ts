import { Injectable } from "@nestjs/common";
import type { ReverieSemanticProject } from "@repo/api";
import { v7 as uuidv7 } from "uuid";

@Injectable()
export class ReverieAdapter {
  adapt(input: unknown): unknown {
    if (!this.isObject(input)) {
      return input;
    }

    if (this.isObject(input.semanticProject)) {
      return input.semanticProject;
    }

    const candidate = { ...input };

    if (
      typeof candidate.semanticId !== "string" ||
      candidate.semanticId.length === 0
    ) {
      candidate.semanticId = this.extractExternalId(candidate) ?? uuidv7();
    }

    if (
      !Array.isArray(candidate.scenes) &&
      typeof candidate.text === "string"
    ) {
      candidate.scenes = [
        {
          title: "Generated scene",
          summary: candidate.text,
          text: candidate.text,
          targetDurationMs: candidate.targetDurationMs,
        },
      ];
    }

    return candidate;
  }

  private extractExternalId(
    candidate: Record<string, unknown>,
  ): string | undefined {
    if (
      typeof candidate.externalId === "string" &&
      candidate.externalId.length > 0
    ) {
      return candidate.externalId;
    }

    if (
      typeof candidate.projectId === "string" &&
      candidate.projectId.length > 0
    ) {
      return `semantic-${candidate.projectId}`;
    }

    return undefined;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  toReverieProject(value: ReverieSemanticProject): ReverieSemanticProject {
    return {
      ...value,
      scenes: value.scenes.map((scene) => ({ ...scene })),
    };
  }
}
