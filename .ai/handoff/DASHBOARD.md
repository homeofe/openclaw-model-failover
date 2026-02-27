# openclaw-model-failover: Build Dashboard

> Single source of truth for build health, test coverage, and pipeline state.
> Updated by agents at the end of every completed task.

---

## Components

| Name | Version | Build | Tests | Status | Notes |
|------|---------|-------|-------|--------|-------|
| openclaw-model-failover | 0.1.6 | (Unknown) | 3 basic (mock) | Production | Active as OpenClaw plugin |

**Legend:** (Verified) - (Assumed) - (Unknown) - Ready - Blocked

---

## Test Coverage

| Suite | Tests | Status | Last Run |
|-------|-------|--------|----------|
| test-logic.ts (mock) | 3 | Pass (mock only) | 2026-02-27 |

> Note: test-logic.ts tests duplicated mock functions, not the actual exports. See issue #1.

---

## v0.2 Roadmap - GitHub Issues

| Issue | Title | Priority | Labels | Status |
|-------|-------|----------|--------|--------|
| [#1](https://github.com/homeofe/openclaw-model-failover/issues/1) | Export internal functions and add proper unit tests | HIGH | enhancement, high-priority | Open |
| [#2](https://github.com/homeofe/openclaw-model-failover/issues/2) | Fix hardcoded PST offset in getNextMidnightPT (ignores daylight saving) | HIGH | bug, high-priority | Open |
| [#3](https://github.com/homeofe/openclaw-model-failover/issues/3) | Add failover status inspection command | MEDIUM | enhancement, medium-priority | Open |
| [#4](https://github.com/homeofe/openclaw-model-failover/issues/4) | Add atomic state file writes to prevent corruption | MEDIUM | bug, medium-priority | Open |
| [#5](https://github.com/homeofe/openclaw-model-failover/issues/5) | Add per-model and per-provider usage metrics | LOW | enhancement, low-priority | Open |

---

## Open Tasks (strategic priority)

| ID | Task | Priority | Blocked by | Ready? |
|----|------|----------|-----------|--------|
| T-001 | Define v0.2 roadmap as GitHub issues | MEDIUM | - | DONE (5 issues created) |
| T-002 | Write unit tests for failover logic | HIGH | - | Ready (see issue #1) |
| T-003 | Fix DST bug in getNextMidnightPT | HIGH | - | Ready (see issue #2) |
| T-004 | Add failover status inspection | MEDIUM | - | Ready (see issue #3) |
| T-005 | Atomic state file writes | MEDIUM | - | Ready (see issue #4) |
| T-006 | Usage metrics and cooldown history | LOW | T-002 | Ready (see issue #5) |

---

## Suggested Implementation Order

1. **#1 (tests)** + **#2 (DST fix)** - do together since tests will cover the fix
2. **#4 (atomic writes)** - small, standalone change
3. **#3 (status command)** - depends on stable state file format
4. **#5 (metrics)** - builds on everything above
