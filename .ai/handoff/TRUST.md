# openclaw-model-failover: Trust Register

> Tracks verification status of critical system properties.

---

## Confidence Levels

| Level | Meaning |
|-------|---------|
| **verified** | An agent executed code, ran tests, or observed output to confirm this |
| **assumed** | Derived from docs, config files, or chat, not directly tested |
| **untested** | Status unknown; needs verification |

---

## Build System

| Property | Status | Last Verified | TTL | Expires | Agent | Notes |
|----------|--------|---------------|-----|---------|-------|-------|
| `npm run build` passes | untested | - | - | - | - | Not verified recently |
| `npm test` passes | untested | - | - | - | - | Script exists, no tests written |
| TypeScript compiles | assumed | 2026-02-25 | 7d | 2026-03-04 | - | Last commit shows no TS errors mentioned |

---

## Plugin Behavior

| Property | Status | Last Verified | TTL | Expires | Agent | Notes |
|----------|--------|---------------|-----|---------|-------|-------|
| Copilot-proxy cooldown detected | assumed | 2026-02-25 | 14d | 2026-03-11 | - | Code reviewed, logic matches intent |
| In-memory session override works | assumed | 2026-02-25 | 14d | 2026-03-11 | - | Code reviewed |
| 40+ LLM failover cycles | untested | - | - | - | - | No automated test |
| Provider-wide blocking correct | assumed | 2026-02-25 | 14d | 2026-03-11 | - | Bug fix in last commit |

---

## Security

| Property | Status | Last Verified | TTL | Expires | Agent | Notes |
|----------|--------|---------------|-----|---------|-------|-------|
| No secrets in source | assumed | 2026-02-26 | 7d | 2026-03-05 | - | Config from OpenClaw plugin system |

---

## Update Rules (for agents)

- Change `untested` - `verified` only after **running actual code/tests**
- Never downgrade `verified` without explaining why in `LOG.md`
