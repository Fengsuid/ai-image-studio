"use strict";

const ALLOWED_DECISIONS = new Set(["duplicate", "variant", "unique", "needs_review", "unavailable"]);

function clampConfidence(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function baseRuleReview(candidate = {}) {
  const method = String(candidate.method || "");
  const score = clampConfidence(candidate.score);
  if (method === "normalized_hash" || score >= 0.94) {
    return {
      status: "reviewed",
      decision: "duplicate",
      confidence: Math.max(score, 0.95),
      reason: "Local normalized hash or very high simhash score indicates the prompts are effectively the same.",
      recommendedAction: "confirm_duplicate"
    };
  }
  if (score >= 0.84) {
    return {
      status: "reviewed",
      decision: "variant",
      confidence: score,
      reason: "Local similarity is high but not exact, so a human should verify whether it is a derivative prompt.",
      recommendedAction: "manual_review"
    };
  }
  return {
    status: "reviewed",
    decision: "needs_review",
    confidence: score,
    reason: "Local similarity is not decisive enough for automatic duplicate handling.",
    recommendedAction: "manual_review"
  };
}

function promptReviewInput(candidate = {}) {
  return {
    candidateId: candidate.id,
    localRecall: {
      method: candidate.method || "",
      score: clampConfidence(candidate.score)
    },
    promptA: {
      id: candidate.promptId,
      title: candidate.prompt?.title || "",
      text: candidate.prompt?.prompt || ""
    },
    promptB: {
      id: candidate.duplicatePromptId,
      title: candidate.duplicate?.title || "",
      text: candidate.duplicate?.prompt || ""
    }
  };
}

function modelPrompt(candidate = {}) {
  return [
    {
      role: "system",
      content: [
        "You review AI image prompts for semantic duplication.",
        "Return only JSON with keys: decision, confidence, reason, recommendedAction.",
        "decision must be one of duplicate, variant, unique, needs_review.",
        "recommendedAction must be confirm_duplicate, keep_distinct, manual_review, or bind_source_image.",
        "Never recommend deletion; uncertain cases must be needs_review or variant."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(promptReviewInput(candidate))
    }
  ];
}

function extractResponseText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.text === "string") return data.text;
  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .map((part) => part.text || part.output_text || "")
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(data.choices)) {
    return data.choices
      .map((choice) => choice.message?.content || choice.text || "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parseModelJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeModelReview(parsed, fallback) {
  const decision = ALLOWED_DECISIONS.has(String(parsed?.decision || "")) ? String(parsed.decision) : fallback.decision;
  const confidence = clampConfidence(parsed?.confidence, fallback.confidence);
  const action = String(parsed?.recommendedAction || fallback.recommendedAction || "manual_review");
  const allowedActions = new Set(["confirm_duplicate", "keep_distinct", "manual_review", "bind_source_image"]);
  return {
    status: "reviewed",
    decision,
    confidence,
    reason: String(parsed?.reason || fallback.reason || "").slice(0, 1000),
    recommendedAction: allowedActions.has(action) ? action : "manual_review"
  };
}

async function reviewPromptDuplicateCandidate(candidate, { callModel, mock = false } = {}) {
  const fallback = baseRuleReview(candidate);
  if (mock || !callModel) {
    return { ...fallback, model: mock ? "mock-rule-review" : "rule-review", raw: { mode: mock ? "mock" : "rule" } };
  }
  try {
    const data = await callModel({
      input: modelPrompt(candidate),
      temperature: 0,
      max_output_tokens: 500
    });
    const parsed = parseModelJson(extractResponseText(data));
    if (!parsed) {
      return {
        status: "unavailable",
        decision: "needs_review",
        confidence: fallback.confidence,
        reason: "Model response could not be parsed; keep candidate in manual review.",
        recommendedAction: "manual_review",
        model: data?.model || "",
        raw: data || {}
      };
    }
    return {
      ...normalizeModelReview(parsed, fallback),
      model: data?.model || "",
      raw: data || {}
    };
  } catch (error) {
    return {
      status: "unavailable",
      decision: "needs_review",
      confidence: fallback.confidence,
      reason: `Model review unavailable: ${String(error.message || error).slice(0, 900)}`,
      recommendedAction: "manual_review",
      model: "",
      raw: { error: String(error.message || error) }
    };
  }
}

module.exports = {
  baseRuleReview,
  promptReviewInput,
  modelPrompt,
  extractResponseText,
  parseModelJson,
  reviewPromptDuplicateCandidate
};
