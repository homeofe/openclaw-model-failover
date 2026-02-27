# openclaw-model-failover: Next Actions for Incoming Agent

> Priority order. Work top-down.
> Updated: 2026-02-26 (AAHP v3 migration)

---

## T-001: Define v0.2 roadmap as GitHub issues

**Goal:** Convert v0.2 feature ideas into tracked GitHub issues with priorities.

**Context:**
- v0.1.2 is stable and in production
- v0.2 roadmap is vague - no concrete issues exist yet
- Repo: https://github.com/homeofe/openclaw-model-failover

**What to do:**
1. Review codebase for TODOs, FIXMEs, and improvement opportunities
2. Create GitHub issues for each v0.2 feature/improvement
3. Add priorities (critical/high/medium/low) and labels
4. Update DASHBOARD.md with the task list

**Definition of done:**
- [ ] At least 3 GitHub issues created for v0.2 work
- [ ] Issues have clear titles and descriptions
- [ ] DASHBOARD.md updated with T-IDs for the new tasks

---

## T-002: Write failing tests for current behavior

**Goal:** Add unit tests that document and protect the copilot-proxy failover logic.

**Context:**
- `npm test` script exists (added in last commit) but no tests written
- Critical logic: cooldown detection, in-memory session override, provider blocking

**What to do:**
1. Read existing plugin source to understand the failover hook structure
2. Create test files using the framework already configured
3. Cover: cooldown detection, failover switching, unavailableCooldownMinutes

**Files:**
- Review existing source files for test targets

**Definition of done:**
- [ ] `npm test` exits with 0
- [ ] At least 5 tests covering core failover logic
- [ ] TRUST.md updated: mark tests as (Verified)

---

## Recently Completed

| Item | Resolution |
|------|-----------|
| Initial scaffold | Done |
| Copilot-proxy cooldown detection | Done in v0.1.2 (commit a35b015) |
| Immediate in-memory session override | Done in v0.1.2 |
| 40+ LLM failover support | Done in v0.1.2 |
| Provider-wide blocking fix | Done in v0.1.2 |

---

## Reference: Key File Locations

| What | Where |
|------|-------|
| Plugin manifest | `openclaw.plugin.json` |
| Package config | `package.json` |
| GitHub repo | https://github.com/homeofe/openclaw-model-failover |
