import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultEvidencePath = path.join(rootDir, "docs", "canvas-v2-regression-window.json");
const validResultStates = new Set(["passed", "failed"]);

function fail(message) {
  throw new Error(message);
}

function parseDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    fail(`${label} must be an ISO date or timestamp`);
  }
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) fail(`${label} is not a valid date: ${value}`);
  return parsed;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const options = { asOf: new Date(), evidencePath: defaultEvidencePath, json: false, requireReady: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--require-ready") options.requireReady = true;
    else if (arg.startsWith("--as-of=")) options.asOf = parseDate(arg.slice(8), "--as-of");
    else if (arg.startsWith("--evidence=")) options.evidencePath = path.resolve(rootDir, arg.slice(11));
    else fail(`unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`unable to read ${label} at ${filePath}: ${error.message}`);
  }
}

function validateEvidence(evidence, packageJson) {
  if (!Number.isInteger(evidence.windowDays) || evidence.windowDays < 1) {
    fail("windowDays must be a positive integer");
  }
  const baselineDate = parseDate(evidence.baseline?.date, "baseline.date");
  if (!Array.isArray(evidence.requiredSmokes) || evidence.requiredSmokes.length === 0) {
    fail("requiredSmokes must contain at least one smoke command");
  }
  const uniqueSmokes = new Set(evidence.requiredSmokes);
  if (uniqueSmokes.size !== evidence.requiredSmokes.length) fail("requiredSmokes contains duplicates");
  for (const smoke of evidence.requiredSmokes) {
    if (typeof smoke !== "string" || !packageJson.scripts?.[smoke]) {
      fail(`required smoke is not exposed by package.json: ${smoke}`);
    }
  }
  if (!Array.isArray(evidence.runs) || evidence.runs.length === 0) fail("runs must contain at least one record");

  const runs = evidence.runs.map((run, index) => {
    const executedAt = parseDate(run.executedAt, `runs[${index}].executedAt`);
    if (executedAt < baselineDate) fail(`runs[${index}] predates the baseline`);
    if (!run.source) fail(`runs[${index}].source is required`);
    for (const smoke of evidence.requiredSmokes) {
      const state = run.results?.[smoke];
      if (!validResultStates.has(state)) fail(`runs[${index}] has invalid ${smoke} result: ${state}`);
    }
    return { ...run, executedAt };
  }).sort((left, right) => left.executedAt - right.executedAt);

  const regressions = (evidence.regressions || []).map((regression, index) => {
    if (!regression.id || !regression.summary) fail(`regressions[${index}] needs id and summary`);
    const discoveredAt = parseDate(regression.discoveredAt, `regressions[${index}].discoveredAt`);
    const resolvedAt = regression.resolvedAt ? parseDate(regression.resolvedAt, `regressions[${index}].resolvedAt`) : null;
    if (resolvedAt && resolvedAt < discoveredAt) fail(`regressions[${index}] resolves before discovery`);
    return { ...regression, discoveredAt, resolvedAt };
  });

  return { baselineDate, runs, regressions };
}

function evaluate(evidence, validated, asOf) {
  const deadline = new Date(validated.baselineDate.getTime() + evidence.windowDays * DAY_MS);
  const completedRuns = validated.runs.filter((run) => run.executedAt <= asOf);
  const fullGreenRuns = completedRuns.filter((run) => evidence.requiredSmokes.every((smoke) => run.results[smoke] === "passed"));
  const lastFullGreen = fullGreenRuns.at(-1) || null;
  const failuresAfterGreen = completedRuns.filter((run) => !lastFullGreen || run.executedAt > lastFullGreen.executedAt)
    .filter((run) => evidence.requiredSmokes.some((smoke) => run.results[smoke] === "failed"));
  const openRegressions = validated.regressions.filter((regression) =>
    regression.discoveredAt <= asOf && (!regression.resolvedAt || regression.resolvedAt > asOf)
  );
  const blockingRegressions = [
    ...openRegressions.map((regression) => `${regression.id}: ${regression.summary}`),
    ...failuresAfterGreen.map((run) => `failed smoke record from ${run.executedAt.toISOString()}`)
  ];
  const daysRemaining = Math.max(0, Math.ceil((deadline - asOf) / DAY_MS));
  const ready = daysRemaining === 0 && blockingRegressions.length === 0 && Boolean(lastFullGreen);
  const decision = ready
    ? "READY_FOR_AIS_RLS_159"
    : blockingRegressions.length > 0
      ? "BLOCKED_BY_REGRESSION"
      : "WAIT_FOR_WINDOW";
  const conclusion = ready
    ? "可执行 AIS-RLS-159：30 天窗口已达到且没有阻断性回归。"
    : blockingRegressions.length > 0
      ? "不可执行 AIS-RLS-159：存在阻断性回归。"
      : `不可执行 AIS-RLS-159：距 30 天门槛还剩 ${daysRemaining} 天。`;

  return {
    gateTask: evidence.gateTask || "AIS-RLS-159",
    baseline: dateOnly(validated.baselineDate),
    deadline: dateOnly(deadline),
    asOf: dateOnly(asOf),
    daysRemaining,
    blockingRegressions,
    lastFullGreen: lastFullGreen ? lastFullGreen.executedAt.toISOString() : null,
    decision,
    conclusion
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  const evidence = readJson(options.evidencePath, "regression evidence");
  const packageJson = readJson(path.join(rootDir, "package.json"), "package.json");
  const result = evaluate(evidence, validateEvidence(evidence, packageJson), options.asOf);

  if (options.json) console.log(JSON.stringify(result));
  else {
    console.log(`[canvas-v2-regression-window] baseline=${result.baseline} deadline=${result.deadline}`);
    console.log(`[canvas-v2-regression-window] asOf=${result.asOf} daysRemaining=${result.daysRemaining}`);
    console.log(`[canvas-v2-regression-window] blockingRegressions=${result.blockingRegressions.length}`);
    console.log(`[canvas-v2-regression-window] lastFullGreen=${result.lastFullGreen || "none"}`);
    console.log(`[canvas-v2-regression-window] decision=${result.decision}`);
    console.log(`[canvas-v2-regression-window] ${result.conclusion}`);
  }
  if (options.requireReady && result.decision !== "READY_FOR_AIS_RLS_159") process.exitCode = 1;
} catch (error) {
  console.error(`[canvas-v2-regression-window] FAIL: ${error.message}`);
  process.exitCode = 1;
}
