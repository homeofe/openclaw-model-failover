# openclaw-model-failover

OpenClaw plugin to **auto-detect rate limits/quota errors** and switch sessions to fallback LLMs.

## What it does

- Chooses a model based on a **preferred order** before each agent run.
- Detects rate-limit/quota failures and marks the current model as **temporarily limited**.
- Detects temporary provider/plugin cooldown errors (for example `copilot-proxy` in cooldown) and fails over.
- Optionally patches pinned WhatsApp group sessions so you don’t get stuck with `API rate limit reached` loops.

## Install (dev)

```bash
cd ~/.openclaw/workspace/openclaw-model-failover
openclaw plugins install -l .
openclaw gateway restart
```

## ClawHub

This plugin is published on **clawhub.ai** and installable via:

```bash
clawhub install openclaw-model-failover
```

## Configure

In your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "openclaw-model-failover": {
        "enabled": true,
        "config": {
          "modelOrder": [
            "openai-codex/gpt-5.3-codex",
            "anthropic/claude-opus-4-6",
            "github-copilot/claude-sonnet-4.6",
            "google-gemini-cli/gemini-3-pro-preview",
            "anthropic/claude-sonnet-4-6",
            "openai-codex/gpt-5.2",
            "google-gemini-cli/gemini-2.5-pro",
            "perplexity/sonar-deep-research",
            "perplexity/sonar-pro",
            "google-gemini-cli/gemini-2.5-flash",
            "google-gemini-cli/gemini-3-flash-preview"
          ],
          "cooldownMinutes": 300,
          "unavailableCooldownMinutes": 15,
          "patchSessionPins": true,
          "notifyOnSwitch": true,
          "debugLogging": false,
          "debugLogSampleRate": 1.0
        }
      }
    }
  }
}
```

## Status Inspection

Check which models are currently blocked and when they become available again.

### CLI

```bash
# Pretty-print current status
npx tsx status.ts

# Machine-readable JSON output
npx tsx status.ts --json

# Clear a specific model's rate limit
npx tsx status.ts clear openai-codex/gpt-5.3-codex

# Clear all rate-limit entries
npx tsx status.ts clear --all
```

### Programmatic API

```typescript
import { getFailoverStatus, clearModel, clearAllModels } from "./status.js";

// Get structured status snapshot
const status = getFailoverStatus();
console.log(status.activeModel);    // current effective model
console.log(status.blockedCount);   // number of blocked models

// Clear a specific model
clearModel("openai-codex/gpt-5.3-codex");

// Clear all rate limits
clearAllModels();
```

### Example output

```
=== OpenClaw Model Failover Status ===

Active model : anthropic/claude-opus-4-6
Models       : 9 available, 2 blocked
State file   : /home/user/.openclaw/workspace/memory/model-ratelimits.json

Blocked models:
  - openai-codex/gpt-5.3-codex
    Reason      : Provider openai-codex exhausted: 429 Too Many Requests
    Available in: 4h 15m (2026-02-27T08:30:00.000Z)
  - openai-codex/gpt-5.2
    Reason      : Provider openai-codex exhausted: 429 Too Many Requests
    Available in: 4h 15m (2026-02-27T08:30:00.000Z)

Model order:
  [BLOCKED] openai-codex/gpt-5.3-codex
  [OK     ] anthropic/claude-opus-4-6
  [OK     ] github-copilot/claude-sonnet-4.6
  [OK     ] google-gemini-cli/gemini-3-pro-preview
  [OK     ] anthropic/claude-sonnet-4-6
  [BLOCKED] openai-codex/gpt-5.2
  [OK     ] google-gemini-cli/gemini-2.5-pro
  [OK     ] perplexity/sonar-deep-research
  [OK     ] perplexity/sonar-pro
  [OK     ] google-gemini-cli/gemini-2.5-flash
  [OK     ] google-gemini-cli/gemini-3-flash-preview
```

## Notes / Limitations (v0.1)

- This MVP does not re-run the exact failed turn automatically. It is conservative by default: it only overrides the model when the pinned model is marked limited.
  It prevents future turns from failing by switching the session model.
- The plugin stores state in `~/.openclaw/workspace/memory/model-ratelimits.json` by default.

## Roadmap

- Auto-retry same turn after switch (requires deeper agent-loop integration)
- Provider-level limits (not only model string keys)
- Per-channel routing policies
