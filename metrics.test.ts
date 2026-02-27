import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  recordEvent,
  loadEvents,
  getMetricsSummary,
  resetMetrics,
  formatMetrics,
  formatEvents,
  DEFAULT_METRICS_FILE,
  type MetricEvent,
  type MetricsSummary,
} from "./metrics.js";
import { nowSec } from "./index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let tmpDir: string;
let metricsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fo-metrics-"));
  metricsPath = path.join(tmpDir, "metrics.jsonl");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function sampleEvent(overrides?: Partial<MetricEvent>): MetricEvent {
  return {
    ts: nowSec(),
    type: "rate_limit",
    model: "provA/model1",
    provider: "provA",
    reason: "429 Too Many Requests",
    cooldownSec: 3600,
    trigger: "agent_end",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. recordEvent and loadEvents
// ---------------------------------------------------------------------------
describe("recordEvent and loadEvents", () => {
  it("appends events to JSONL file and loads them back", () => {
    const e1 = sampleEvent({ ts: 1000 });
    const e2 = sampleEvent({ ts: 2000, model: "provB/model2", provider: "provB" });

    recordEvent(metricsPath, e1);
    recordEvent(metricsPath, e2);

    const events = loadEvents(metricsPath);
    expect(events).toHaveLength(2);
    expect(events[0].ts).toBe(1000);
    expect(events[1].model).toBe("provB/model2");
  });

  it("creates parent directories if they do not exist", () => {
    const deepPath = path.join(tmpDir, "a", "b", "c", "metrics.jsonl");
    recordEvent(deepPath, sampleEvent());

    const events = loadEvents(deepPath);
    expect(events).toHaveLength(1);
  });

  it("returns empty array when file does not exist", () => {
    const events = loadEvents(path.join(tmpDir, "nonexistent.jsonl"));
    expect(events).toHaveLength(0);
  });

  it("skips malformed lines and parses valid ones", () => {
    fs.writeFileSync(
      metricsPath,
      '{"ts":1000,"type":"rate_limit","model":"a/b","provider":"a"}\nnot-json\n{"ts":2000,"type":"failover","model":"a/b","provider":"a","to":"c/d"}\n',
    );

    const events = loadEvents(metricsPath);
    expect(events).toHaveLength(2);
    expect(events[0].ts).toBe(1000);
    expect(events[1].ts).toBe(2000);
  });

  it("handles empty file gracefully", () => {
    fs.writeFileSync(metricsPath, "");
    const events = loadEvents(metricsPath);
    expect(events).toHaveLength(0);
  });

  it("preserves all event fields through serialization", () => {
    const event: MetricEvent = {
      ts: 12345,
      type: "failover",
      model: "provA/model1",
      provider: "provA",
      reason: "rate limit hit",
      cooldownSec: 1800,
      to: "provB/model2",
      trigger: "message_sent",
      session: "sess-abc",
    };

    recordEvent(metricsPath, event);
    const loaded = loadEvents(metricsPath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(event);
  });
});

// ---------------------------------------------------------------------------
// 2. getMetricsSummary - empty
// ---------------------------------------------------------------------------
describe("getMetricsSummary - empty", () => {
  it("returns zeroed summary when no file exists", () => {
    const summary = getMetricsSummary({
      metricsPath: path.join(tmpDir, "nonexistent.jsonl"),
    });

    expect(summary.totalEvents).toBe(0);
    expect(summary.totalRateLimits).toBe(0);
    expect(summary.totalAuthErrors).toBe(0);
    expect(summary.totalUnavailable).toBe(0);
    expect(summary.totalFailovers).toBe(0);
    expect(summary.since).toBeUndefined();
    expect(Object.keys(summary.models)).toHaveLength(0);
    expect(Object.keys(summary.providers)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. getMetricsSummary - aggregation
// ---------------------------------------------------------------------------
describe("getMetricsSummary - aggregation", () => {
  it("counts rate limits correctly", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100 }));
    recordEvent(metricsPath, sampleEvent({ ts: 200 }));
    recordEvent(metricsPath, sampleEvent({ ts: 300, model: "provA/model2" }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalRateLimits).toBe(3);
    expect(summary.totalEvents).toBe(3);
    expect(summary.since).toBe(100);
    expect(summary.models["provA/model1"].rateLimits).toBe(2);
    expect(summary.models["provA/model2"].rateLimits).toBe(1);
    expect(summary.providers["provA"].rateLimits).toBe(3);
  });

  it("counts auth errors correctly", () => {
    recordEvent(metricsPath, sampleEvent({
      ts: 100,
      type: "auth_error",
      reason: "invalid api key",
      cooldownSec: 43200,
    }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalAuthErrors).toBe(1);
    expect(summary.models["provA/model1"].authErrors).toBe(1);
    expect(summary.providers["provA"].authErrors).toBe(1);
  });

  it("counts unavailable errors correctly", () => {
    recordEvent(metricsPath, sampleEvent({
      ts: 100,
      type: "unavailable",
      reason: "service unavailable",
      cooldownSec: 900,
    }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalUnavailable).toBe(1);
    expect(summary.models["provA/model1"].unavailableErrors).toBe(1);
    expect(summary.providers["provA"].unavailableErrors).toBe(1);
  });

  it("counts failovers and tracks from/to", () => {
    recordEvent(metricsPath, sampleEvent({
      ts: 100,
      type: "failover",
      model: "provA/model1",
      to: "provB/model2",
    }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalFailovers).toBe(1);
    expect(summary.models["provA/model1"].timesFailedFrom).toBe(1);
    expect(summary.models["provB/model2"].timesFailedTo).toBe(1);
  });

  it("accumulates total cooldown seconds", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100, cooldownSec: 1000 }));
    recordEvent(metricsPath, sampleEvent({ ts: 200, cooldownSec: 2000 }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.models["provA/model1"].totalCooldownSec).toBe(3000);
    expect(summary.providers["provA"].totalCooldownSec).toBe(3000);
  });

  it("tracks lastHitAt as the latest timestamp for each model", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100 }));
    recordEvent(metricsPath, sampleEvent({ ts: 500 }));
    recordEvent(metricsPath, sampleEvent({ ts: 300 }));

    const summary = getMetricsSummary({ metricsPath });
    // lastHitAt is set per-event, so it will be the last event processed
    expect(summary.models["provA/model1"].lastHitAt).toBe(300);
  });

  it("handles multiple providers and models", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100, model: "provA/m1", provider: "provA" }));
    recordEvent(metricsPath, sampleEvent({ ts: 200, model: "provA/m2", provider: "provA" }));
    recordEvent(metricsPath, sampleEvent({ ts: 300, model: "provB/m3", provider: "provB", type: "auth_error" }));
    recordEvent(metricsPath, sampleEvent({
      ts: 400,
      type: "failover",
      model: "provA/m1",
      provider: "provA",
      to: "provB/m3",
    }));

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalEvents).toBe(4);
    expect(summary.totalRateLimits).toBe(2);
    expect(summary.totalAuthErrors).toBe(1);
    expect(summary.totalFailovers).toBe(1);
    expect(Object.keys(summary.providers)).toHaveLength(2);
    expect(Object.keys(summary.models)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4. getMetricsSummary - time filtering
// ---------------------------------------------------------------------------
describe("getMetricsSummary - time filtering", () => {
  it("filters events by since parameter", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100 }));
    recordEvent(metricsPath, sampleEvent({ ts: 200 }));
    recordEvent(metricsPath, sampleEvent({ ts: 300 }));

    const summary = getMetricsSummary({ metricsPath, since: 200 });
    expect(summary.totalEvents).toBe(2);
    expect(summary.since).toBe(200);
  });

  it("filters events by until parameter", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100 }));
    recordEvent(metricsPath, sampleEvent({ ts: 200 }));
    recordEvent(metricsPath, sampleEvent({ ts: 300 }));

    const summary = getMetricsSummary({ metricsPath, until: 200 });
    expect(summary.totalEvents).toBe(2);
  });

  it("filters with both since and until", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 100 }));
    recordEvent(metricsPath, sampleEvent({ ts: 200 }));
    recordEvent(metricsPath, sampleEvent({ ts: 300 }));
    recordEvent(metricsPath, sampleEvent({ ts: 400 }));

    const summary = getMetricsSummary({ metricsPath, since: 150, until: 350 });
    expect(summary.totalEvents).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. resetMetrics
// ---------------------------------------------------------------------------
describe("resetMetrics", () => {
  it("deletes the metrics file and returns true", () => {
    recordEvent(metricsPath, sampleEvent());
    expect(fs.existsSync(metricsPath)).toBe(true);

    const result = resetMetrics(metricsPath);
    expect(result).toBe(true);
    expect(fs.existsSync(metricsPath)).toBe(false);
  });

  it("returns false when file does not exist", () => {
    const result = resetMetrics(path.join(tmpDir, "nonexistent.jsonl"));
    expect(result).toBe(false);
  });

  it("results in empty summary after reset", () => {
    recordEvent(metricsPath, sampleEvent());
    resetMetrics(metricsPath);

    const summary = getMetricsSummary({ metricsPath });
    expect(summary.totalEvents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. formatMetrics
// ---------------------------------------------------------------------------
describe("formatMetrics", () => {
  it("shows 'no events' message for empty summary", () => {
    const summary = getMetricsSummary({
      metricsPath: path.join(tmpDir, "nonexistent.jsonl"),
    });

    const output = formatMetrics(summary);
    expect(output).toContain("No failover events recorded yet.");
    expect(output).toContain("OpenClaw Model Failover Metrics");
  });

  it("shows summary with counts and breakdowns", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 1000, model: "provA/m1", provider: "provA" }));
    recordEvent(metricsPath, sampleEvent({
      ts: 2000,
      type: "auth_error",
      model: "provB/m2",
      provider: "provB",
      cooldownSec: 43200,
    }));
    recordEvent(metricsPath, sampleEvent({
      ts: 3000,
      type: "failover",
      model: "provA/m1",
      provider: "provA",
      to: "provB/m2",
    }));

    const summary = getMetricsSummary({ metricsPath });
    const output = formatMetrics(summary);

    expect(output).toContain("Total events : 3");
    expect(output).toContain("Rate limits  : 1");
    expect(output).toContain("Auth errors  : 1");
    expect(output).toContain("Failovers    : 1");
    expect(output).toContain("By provider:");
    expect(output).toContain("provA");
    expect(output).toContain("provB");
    expect(output).toContain("By model:");
    expect(output).toContain("provA/m1");
    expect(output).toContain("provB/m2");
  });

  it("shows period range", () => {
    recordEvent(metricsPath, sampleEvent({ ts: 1000000 }));
    recordEvent(metricsPath, sampleEvent({ ts: 2000000 }));

    const summary = getMetricsSummary({ metricsPath });
    const output = formatMetrics(summary);

    expect(output).toContain("Period");
    // Should contain ISO date strings
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// 7. formatEvents
// ---------------------------------------------------------------------------
describe("formatEvents", () => {
  it("returns 'No events.' for empty array", () => {
    expect(formatEvents([])).toBe("No events.");
  });

  it("formats rate limit events with timestamp and details", () => {
    const events: MetricEvent[] = [
      sampleEvent({ ts: 1709000000, reason: "429 Too Many Requests", cooldownSec: 3600 }),
    ];

    const output = formatEvents(events);
    expect(output).toContain("RATE_LIMIT");
    expect(output).toContain("provA/model1");
    expect(output).toContain("429 Too Many Requests");
    expect(output).toContain("cooldown=3600s");
  });

  it("formats failover events with target model", () => {
    const events: MetricEvent[] = [
      sampleEvent({
        ts: 1709000000,
        type: "failover",
        model: "provA/m1",
        to: "provB/m2",
      }),
    ];

    const output = formatEvents(events);
    expect(output).toContain("FAILOVER");
    expect(output).toContain("provA/m1");
    expect(output).toContain("-> provB/m2");
  });

  it("formats multiple events on separate lines", () => {
    const events: MetricEvent[] = [
      sampleEvent({ ts: 1000 }),
      sampleEvent({ ts: 2000, type: "auth_error" }),
    ];

    const output = formatEvents(events);
    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 8. DEFAULT_METRICS_FILE
// ---------------------------------------------------------------------------
describe("DEFAULT_METRICS_FILE", () => {
  it("has a sensible default path", () => {
    expect(DEFAULT_METRICS_FILE).toContain(".openclaw");
    expect(DEFAULT_METRICS_FILE).toContain("metrics");
    expect(DEFAULT_METRICS_FILE.endsWith(".jsonl")).toBe(true);
  });
});
