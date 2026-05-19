#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  baseRuleReview,
  parseModelJson,
  reviewPromptDuplicateCandidate
} from "../../src/prompt-review-service.js";

const exact = {
  id: 1,
  method: "normalized_hash",
  score: 1,
  promptId: 10,
  duplicatePromptId: 11,
  prompt: { title: "A", prompt: "cinematic cat portrait, golden hour" },
  duplicate: { title: "B", prompt: "cinematic cat portrait, golden hour" }
};

const rule = baseRuleReview(exact);
assert.equal(rule.decision, "duplicate");
assert.equal(rule.recommendedAction, "confirm_duplicate");

const parsed = parseModelJson("prefix {\"decision\":\"variant\",\"confidence\":0.82,\"reason\":\"same subject\",\"recommendedAction\":\"manual_review\"}");
assert.equal(parsed.decision, "variant");

const mocked = await reviewPromptDuplicateCandidate(exact, { mock: true });
assert.equal(mocked.decision, "duplicate");
assert.equal(mocked.model, "mock-rule-review");

const model = await reviewPromptDuplicateCandidate(exact, {
  callModel: async () => ({
    model: "smoke-model",
    output_text: JSON.stringify({
      decision: "unique",
      confidence: 0.61,
      reason: "different composition",
      recommendedAction: "keep_distinct"
    })
  })
});
assert.equal(model.decision, "unique");
assert.equal(model.recommendedAction, "keep_distinct");
assert.equal(model.model, "smoke-model");

console.log("[prompt-review-smoke] ok");
