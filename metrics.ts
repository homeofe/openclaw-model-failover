/**
 * Usage metrics and cooldown history.
 *
 * Provides an append-only JSONL event log for failover events and
 * aggregate summary functions for capacity planning and model order optimization.
 *
 * Standalone CLI usage:
 *   npx tsx metrics.ts                    # pretty-print metrics summary
 *   npx tsx metrics.ts --json             # machine-readable JSON summary
 *   npx tsx metrics.ts tail [N]           # show last N events (default 20)
 *   npx tsx metrics.ts reset              # clear all metrics
 *
 * Programmatic usage:
 *   import { recordEvent, loadEvents, getMetricsSummary, formatMetrics } from "./metrics.js";
 */

import fs from "node:fs";
import path from "node:path";

import { expandHome, nowSec } from "./index.js";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type MetricEventType = "rate_limit" | "auth_error" | "unavailable" | "failover";

export interface MetricEvent {
  ts: number;
  type: MetricEventType;
  model: string;
  provider: string;
  reason?: string;
  cooldownSec?: number;
  /** For failover events: the model we switched to. */
  to?: string;
  /** Hook that triggered the event (agent_end | message_sent). */
  trigger?: string;
  session?: string;
}

export interface ModelMetrics {
  rateLimits: number;
  authErrors: number;
  unavailableErrors: number;
  timesFailedFrom: number;
  timesFailedTo: number;
  lastHitAt?: number;
  totalCooldownSec: number;
}

export interface ProviderMetrics {
  rateLimits: number;
  authErrors: number;
  unavailableErrors: number;
  totalCooldownSec: number;
}

export interface MetricsSummary {
  since: number | undefined;
  until: number;
  totalEvents: number;
  totalRateLimits: number;
  totalAuthErrors: number;
  totalUnavailable: number;
  totalFailovers: number;
  models: Record<string, ModelMetrics>;
  providers: Record<string, ProviderMetrics>;
}

// -------------------------------------------------------------------------
// Default path
// -------------------------------------------------------------------------

export const DEFAULT_METRICS_FILE = "~/.openclaw/workspace/memory/model-failover-metrics.jsonl";

// -------------------------------------------------------------------------
// Event recording
// -------------------------------------------------------------------------

/**
 * Append a single metric event to the JSONL log file.
 * Creates the file and parent directories if they do not exist.
 */
export function recordEvent(metricsPath: string, event: MetricEvent): void {
  const resolved = expandHome(metricsPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(resolved, line, "utf-8");
}

// -------------------------------------------------------------------------
// Event loading
// -------------------------------------------------------------------------

/**
 * Read and parse all events from the JSONL log file.
 * Returns an empty array if the file does not exist or is corrupt.
 * Malformed lines are silently skipped.
 */
export function loadEvents(metricsPath: string): MetricEvent[] {
  const resolved = expandHome(metricsPath);
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf-8");
  } catch {
    return [];
  }

  const events: MetricEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as MetricEvent);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

// -------------------------------------------------------------------------
// Aggregation
// -------------------------------------------------------------------------

function emptyModelMetrics(): ModelMetrics {
  return {
    rateLimits: 0,
    authErrors: 0,
    unavailableErrors: 0,
    timesFailedFrom: 0,
    timesFailedTo: 0,
    totalCooldownSec: 0,
  };
}

function emptyProviderMetrics(): ProviderMetrics {
  return {
    rateLimits: 0,
    authErrors: 0,
    unavailableErrors: 0,
    totalCooldownSec: 0,
  };
}

/**
 * Build an aggregate summary from the event log.
 * Optionally filter to events within a time window.
 */
export function getMetricsSummary(opts?: {
  metricsPath?: string;
  since?: number;
  until?: number;
}): MetricsSummary {
  const metricsPath = opts?.metricsPath ?? DEFAULT_METRICS_FILE;
  const allEvents = loadEvents(metricsPath);
  const sinceFilter = opts?.since ?? 0;
  const untilFilter = opts?.until ?? Infinity;

  const events = allEvents.filter(
    (e) => e.ts >= sinceFilter && e.ts <= untilFilter,
  );

  const models: Record<string, ModelMetrics> = {};
  const providers: Record<string, ProviderMetrics> = {};

  let totalRateLimits = 0;
  let totalAuthErrors = 0;
  let totalUnavailable = 0;
  let totalFailovers = 0;
  let earliest: number | undefined;

  for (const e of events) {
    if (earliest === undefined || e.ts < earliest) earliest = e.ts;

    // Ensure model and provider buckets exist
    if (!models[e.model]) models[e.model] = emptyModelMetrics();
    if (!providers[e.provider]) providers[e.provider] = emptyProviderMetrics();

    const m = models[e.model];
    const p = providers[e.provider];

    switch (e.type) {
      case "rate_limit":
        totalRateLimits++;
        m.rateLimits++;
        p.rateLimits++;
        m.lastHitAt = e.ts;
        if (e.cooldownSec) {
          m.totalCooldownSec += e.cooldownSec;
          p.totalCooldownSec += e.cooldownSec;
        }
        break;
      case "auth_error":
        totalAuthErrors++;
        m.authErrors++;
        p.authErrors++;
        m.lastHitAt = e.ts;
        if (e.cooldownSec) {
          m.totalCooldownSec += e.cooldownSec;
          p.totalCooldownSec += e.cooldownSec;
        }
        break;
      case "unavailable":
        totalUnavailable++;
        m.unavailableErrors++;
        p.unavailableErrors++;
        m.lastHitAt = e.ts;
        if (e.cooldownSec) {
          m.totalCooldownSec += e.cooldownSec;
          p.totalCooldownSec += e.cooldownSec;
        }
        break;
      case "failover":
        totalFailovers++;
        m.timesFailedFrom++;
        if (e.to) {
          if (!models[e.to]) models[e.to] = emptyModelMetrics();
          models[e.to].timesFailedTo++;
        }
        break;
    }
  }

  return {
    since: earliest,
    until: events.length > 0 ? events[events.length - 1].ts : nowSec(),
    totalEvents: events.length,
    totalRateLimits,
    totalAuthErrors,
    totalUnavailable,
    totalFailovers,
    models,
    providers,
  };
}

// -------------------------------------------------------------------------
// Reset
// -------------------------------------------------------------------------

/**
 * Delete the metrics log file. Returns true if the file existed.
 */
export function resetMetrics(metricsPath?: string): boolean {
  const resolved = expandHome(metricsPath ?? DEFAULT_METRICS_FILE);
  try {
    fs.unlinkSync(resolved);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------
// Formatting
// -------------------------------------------------------------------------

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

/**
 * Pretty-print a MetricsSummary for terminal output.
 */
export function formatMetrics(summary: MetricsSummary): string {
  const lines: string[] = [];

  lines.push("=== OpenClaw Model Failover Metrics ===");
  lines.push("");

  if (summary.totalEvents === 0) {
    lines.push("No failover events recorded yet.");
    return lines.join("\n");
  }

  const sinceStr = summary.since
    ? new Date(summary.since * 1000).toISOString()
    : "n/a";
  const untilStr = new Date(summary.until * 1000).toISOString();

  lines.push(`Period       : ${sinceStr} - ${untilStr}`);
  lines.push(`Total events : ${summary.totalEvents}`);
  lines.push(`Rate limits  : ${summary.totalRateLimits}`);
  lines.push(`Auth errors  : ${summary.totalAuthErrors}`);
  lines.push(`Unavailable  : ${summary.totalUnavailable}`);
  lines.push(`Failovers    : ${summary.totalFailovers}`);

  // Provider breakdown
  const providerNames = Object.keys(summary.providers).sort();
  if (providerNames.length > 0) {
    lines.push("");
    lines.push("By provider:");
    for (const name of providerNames) {
      const p = summary.providers[name];
      const total = p.rateLimits + p.authErrors + p.unavailableErrors;
      lines.push(
        `  ${pad(name, 30)} ${total} error${total !== 1 ? "s" : ""}  (rate=${p.rateLimits} auth=${p.authErrors} unavail=${p.unavailableErrors})`,
      );
    }
  }

  // Model breakdown
  const modelNames = Object.keys(summary.models).sort();
  if (modelNames.length > 0) {
    lines.push("");
    lines.push("By model:");
    for (const name of modelNames) {
      const m = summary.models[name];
      const errors = m.rateLimits + m.authErrors + m.unavailableErrors;
      const parts: string[] = [];
      if (errors > 0) parts.push(`${errors} error${errors !== 1 ? "s" : ""}`);
      if (m.timesFailedFrom > 0) parts.push(`failed-from=${m.timesFailedFrom}`);
      if (m.timesFailedTo > 0) parts.push(`failed-to=${m.timesFailedTo}`);
      lines.push(`  ${pad(name, 40)} ${parts.join("  ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format a list of events for terminal output (tail view).
 */
export function formatEvents(events: MetricEvent[]): string {
  if (events.length === 0) return "No events.";

  const lines: string[] = [];
  for (const e of events) {
    const ts = new Date(e.ts * 1000).toISOString().replace("T", " ").slice(0, 19);
    const parts = [`[${ts}]`, e.type.toUpperCase()];
    parts.push(e.model);
    if (e.type === "failover" && e.to) parts.push(`-> ${e.to}`);
    if (e.reason) parts.push(`(${e.reason.slice(0, 80)})`);
    if (e.cooldownSec) parts.push(`cooldown=${e.cooldownSec}s`);
    lines.push(parts.join(" "));
  }
  return lines.join("\n");
}

// -------------------------------------------------------------------------
// CLI entry point
// -------------------------------------------------------------------------

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("metrics.ts") || process.argv[1].endsWith("metrics.js"));

if (isDirectRun) {
  const args = process.argv.slice(2);

  if (args[0] === "tail") {
    const count = parseInt(args[1] ?? "20", 10);
    const events = loadEvents(DEFAULT_METRICS_FILE);
    const tail = events.slice(-count);
    console.log(formatEvents(tail));
  } else if (args[0] === "reset") {
    const existed = resetMetrics();
    console.log(
      existed
        ? "Metrics log cleared."
        : "No metrics log found.",
    );
  } else if (args[0] === "--json") {
    const summary = getMetricsSummary();
    console.log(JSON.stringify(summary, null, 2));
  } else if (args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "Usage: npx tsx metrics.ts [command] [options]",
        "",
        "Commands:",
        "  (default)             Pretty-print metrics summary",
        "  --json                Output summary as JSON",
        "  tail [N]              Show last N events (default 20)",
        "  reset                 Clear all metrics",
        "  --help, -h            Show this help message",
      ].join("\n"),
    );
  } else {
    const summary = getMetricsSummary();
    console.log(formatMetrics(summary));
  }
}
