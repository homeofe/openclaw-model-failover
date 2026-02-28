# openclaw-model-failover: Autonomous Multi-Agent Workflow

> Based on the [AAHP Protocol](https://github.com/homeofe/AAHP).

---

## Agent Roles

| Agent | Model | Role | Responsibility |
|-------|-------|------|---------------|
| Implementer | claude-sonnet | Implementer | Code, tests, commits |
| Reviewer | gpt-4 or second model | Reviewer | Code review, edge cases |

---

## The Pipeline

### Phase 1: Implement

```
Reads:   handoff/NEXT_ACTIONS.md (top unblocked task)
         handoff/STATUS.md
         CONVENTIONS.md (MANDATORY before first commit)

Does:    Creates feature branch
         Writes code + unit tests
         Runs: npm run build && npm test
         Commits and pushes branch
```

### Phase 2: Review & Handoff

```
Reviewer reviews code on feature branch.
Documents findings in LOG.md.

After review:
  DASHBOARD.md:    Update task status
  STATUS.md:       Update component state
  LOG.md:          Append session summary
  NEXT_ACTIONS.md: Update task T-IDs
```

---

## Autonomy Boundaries

| Allowed | Not allowed |
|---------|-------------|
| Write & commit code | Push directly to `main` |
| Write & run tests | Install new dependencies without documenting |
| Push feature branches | Write secrets into source |

---

*Continuously refined by agents and humans.*
