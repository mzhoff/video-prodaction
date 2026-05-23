import assert from "node:assert/strict";
import test from "node:test";

import {
  exampleRenderJobDone,
  exampleRenderRequest,
  exampleRenderResultDone,
  exampleVideoProject,
  invalidVideoProjectExample,
} from "../src/contracts/examples.js";
import {
  validateRenderJob,
  validateRenderRequest,
  validateRenderResult,
  validateVideoProject,
} from "../src/contracts/validation.js";

test("validateVideoProject passes for valid example", () => {
  const result = validateVideoProject(exampleVideoProject);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.id, "project-001");
    assert.equal(result.value.versions[0]?.id, "version-1");
  }
});

test("validateVideoProject fails for invalid example", () => {
  const result = validateVideoProject(invalidVideoProjectExample);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.issues.some((issue) => issue.path === "videoProject.createdAt"),
    );
    assert.ok(
      result.issues.some(
        (issue) => issue.path === "videoProject.currentVersionId",
      ),
    );
  }
});

test("validateRenderRequest passes for valid example", () => {
  const result = validateRenderRequest(exampleRenderRequest);

  assert.equal(result.ok, true);
});

test("validateRenderResult passes for successful result", () => {
  const result = validateRenderResult(exampleRenderResultDone);

  assert.equal(result.ok, true);
});

test("validateRenderJob passes for done job with result", () => {
  const result = validateRenderJob(exampleRenderJobDone);

  assert.equal(result.ok, true);
});

test("validateRenderJob fails when status is done but result is missing", () => {
  const result = validateRenderJob({
    ...exampleRenderJobDone,
    result: undefined,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "renderJob.result"));
  }
});
