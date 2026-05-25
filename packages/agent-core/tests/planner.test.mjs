import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildAgentPlan, summarizeAgentPlan } = require("../src/planner");
const agentCore = require("../index.js");

test("buildAgentPlan returns frozen-format envelope with confirmation gate", () => {
  const plan = buildAgentPlan("我想做一组宋代瓷器主视觉海报");
  assert.equal(plan.format, "ai-image-studio.agent-plan.v1");
  assert.equal(plan.confirmationRequired, true);
  assert.equal(plan.willCreateGenerations, false);
  assert.equal(plan.nextAction, "confirm_plan_before_batch_generation");
  assert.equal(plan.variantCount, plan.variants.length);
  assert(plan.variantCount >= 2 && plan.variantCount <= 4, "variantCount must be between 2 and 4");
  for (const variant of plan.variants) {
    assert(variant.id && variant.title && variant.prompt, "variant must have id/title/prompt");
    assert(["1024x1024", "1024x1536", "1536x1024"].includes(variant.size), "variant size must be a supported value");
  }
});

test("buildAgentPlan throws when message is missing", () => {
  assert.throws(() => buildAgentPlan(""), /Agent plan message is required/);
});

test("buildAgentPlan honors variantCount within [2,4]", () => {
  assert.equal(buildAgentPlan("test brief", { variantCount: 2 }).variants.length, 2);
  assert.equal(buildAgentPlan("test brief", { variantCount: 9 }).variants.length, 4);
  assert.equal(buildAgentPlan("test brief", { variantCount: 0 }).variants.length, 2);
  assert.equal(buildAgentPlan("test brief", { variantCount: "bad" }).variants.length, 4);
});

test("summarizeAgentPlan mentions confirmation and variant titles", () => {
  const plan = buildAgentPlan("社媒封面图，强调小红书可读性");
  const summary = summarizeAgentPlan(plan);
  assert(summary.includes("确认前不会扣积分"), "summary should explain no-credit-before-confirm contract");
  for (const variant of plan.variants) {
    assert(summary.includes(variant.title), `summary should include variant title ${variant.title}`);
  }
});

test("agent-core package exposes INTERFACE.md normalized exports", () => {
  assert.equal(typeof agentCore.createGenerationService, "function");
  assert.equal(typeof agentCore.createRoutes, "function");
  assert.equal(typeof agentCore.createSessionStore, "function");
  assert.equal(typeof agentCore.applySchema, "function");
  assert.equal(typeof agentCore.buildAgentPlan, "function");
  assert.equal(typeof agentCore.summarizeAgentPlan, "function");
});
