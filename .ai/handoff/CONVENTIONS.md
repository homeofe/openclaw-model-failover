# openclaw-model-failover: Agent Conventions

> Every agent working on this project must read and follow these conventions.

---

## Language

- All code, comments, commits, and documentation in **English only**

## Code Style

- **TypeScript:** strict mode, conventional commits, Prettier formatting
- Plugin must export hooks compatible with OpenClaw plugin API

## Branching & Commits

```
feat/<scope>-<short-name>    - new feature
fix/<scope>-<short-name>     - bug fix

Commit format:
  feat(scope): description [AAHP-auto]
  fix(scope): description [AAHP-fix]
```

## Architecture Principles

- **Hook-based**: Plugin integrates via `before_model_resolve` and similar OpenClaw hooks
- **In-memory state**: Rate limit and cooldown state stored in-memory (JSON file for persistence)
- **Zero-config first**: Sensible defaults, all config optional
- **Non-destructive**: Never modifies the original model request - only redirects

## Testing

- All new hook logic must have unit tests
- `npm test` must pass before every commit

## Formatting

- **No em dashes (`-`)**: Use a regular hyphen (`-`) instead.

## What Agents Must NOT Do

- Push directly to `main`
- Write secrets or credentials into source files
- Use em dashes (`-`) anywhere in the codebase

---

*Update this file when conventions evolve.*
