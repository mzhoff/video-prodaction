import { BadRequestException } from "@nestjs/common";
import { timelineCaseExamples } from "@repo/api";
import { describe, expect, it, vi } from "vitest";

import { ReverieAdapter } from "./reverie.adapter.js";
import { TimelineService } from "./timeline.service.js";
import type { StoredTimelineDraft } from "./timeline-drafts.repository.js";

describe("TimelineService", () => {
  const storage = new Map<string, StoredTimelineDraft>();
  const repository = {
    create: vi.fn(
      async (params: {
        externalId: string;
        sourceSemanticId: string;
        useCase: StoredTimelineDraft["useCase"];
        semanticProject: StoredTimelineDraft["semanticProject"];
        draft: StoredTimelineDraft["draft"];
      }) => {
        storage.set(params.externalId, {
          externalId: params.externalId,
          sourceSemanticId: params.sourceSemanticId,
          useCase: params.useCase,
          semanticProject: params.semanticProject,
          draft: params.draft,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
    ),
    findByExternalId: vi.fn(
      async (externalId: string) => storage.get(externalId) ?? null,
    ),
  };
  const service = new TimelineService(
    new ReverieAdapter(),
    repository as never,
  );

  it("returns three predefined cases", () => {
    const examples = service.getCaseExamples();

    expect(examples).toHaveLength(3);
    expect(examples.map((item) => item.id)).toEqual([
      "hook",
      "one-minute-script",
      "social-post",
    ]);
  });

  it("builds timeline draft for every predefined semantic case", async () => {
    for (const example of timelineCaseExamples) {
      const response = await service.previewTimelineDraft(
        example.semanticProject,
      );

      expect(response.timelineDraft.useCase).toBe(example.id);
      expect(response.timelineDraft.scenes.length).toBe(
        example.expectedTimeline.scenes.length,
      );
      expect(response.timelineDraft.totalDurationMs).toBe(
        example.expectedTimeline.totalDurationMs,
      );
      expect(response.timelineDraftId).toBeTypeOf("string");
    }
  });

  it("throws validation error for invalid semantic payload", async () => {
    await expect(
      service.previewTimelineDraft({ useCase: "hook", scenes: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns persisted draft by id", async () => {
    const [firstExample] = timelineCaseExamples;
    if (!firstExample) {
      throw new Error("Expected at least one timeline case example");
    }
    const created = await service.previewTimelineDraft(
      firstExample.semanticProject,
    );

    const loaded = await service.getTimelineDraft(created.timelineDraftId);
    expect(loaded.timelineDraftId).toBe(created.timelineDraftId);
    expect(loaded.timelineDraft.scenes.length).toBe(
      created.timelineDraft.scenes.length,
    );
  });
});
