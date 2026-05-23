import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTimelineDraft,
  timelineCaseExamples,
  validateReverieSemanticProject,
} from "../src/entry.js";

test("timeline examples contain 3 predefined use cases", () => {
  assert.equal(timelineCaseExamples.length, 3);
  assert.deepEqual(
    timelineCaseExamples.map((item) => item.id),
    ["hook", "one-minute-script", "social-post"],
  );
});

test("semantic examples pass validation", () => {
  timelineCaseExamples.forEach((example) => {
    const validation = validateReverieSemanticProject(example.semanticProject);
    assert.equal(validation.ok, true);
  });
});

test("builder creates expected timeline shape for each case", () => {
  timelineCaseExamples.forEach((example) => {
    const validation = validateReverieSemanticProject(example.semanticProject);
    assert.equal(validation.ok, true);

    if (!validation.ok) {
      return;
    }

    const built = buildTimelineDraft(validation.value);

    assert.equal(built.useCase, example.id);
    assert.equal(
      built.totalDurationMs,
      example.expectedTimeline.totalDurationMs,
    );
    assert.equal(built.scenes.length, example.expectedTimeline.scenes.length);

    built.scenes.forEach((scene, index) => {
      const expected = example.expectedTimeline.scenes[index];
      assert.equal(scene.id, expected?.id);
      assert.equal(scene.durationMs, expected?.durationMs);
      assert.equal(scene.startMs, expected?.startMs);
      assert.equal(scene.mode, expected?.mode);
      assert.equal(scene.assetStrategy, expected?.assetStrategy);
    });
  });
});
