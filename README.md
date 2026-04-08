# Feedback Triage Queue

An AI-powered feedback triage system built on Cloudflare's edge infrastructure. Ingests feedback from multiple sources, automatically analyses each item for sentiment, severity, and business impact using Workers AI, and surfaces a prioritised queue for product managers to action.

Built as a submission for the Cloudflare Product Manager assignment.

**Live prototype:** https://triage-queue.snig-17.workers.dev/app

---

## The Problem

Product teams receive more feedback than they can manually triage. Without automation, PMs spend time sorting and scoring inputs rather than making decisions. This system handles the first pass — every incoming item is automatically analysed for urgency, sentiment, and business risk — so the queue that reaches a PM is already prioritised and actionable.

---

## Features

- Multi-source feedback ingestion with metadata tagging
- Async AI analysis pipeline — non-blocking, ~20–30s per item via Cloudflare Workflows
- Priority scoring based on composite sentiment, severity, and business risk signals
- Human-in-the-loop override layer — PMs can approve, reject, or rerun any analysis
- Full audit trail of all override actions
- AI chat assistant for queue-level queries ("What should I focus on today?", "How many critical items are pending?")

---

## Architecture

### Cloudflare D1 (SQLite at the edge)

Persistent storage across three tables:

- `feedback` — raw inputs with source and metadata
- `analysis` — AI-generated results including priority score, signals, sentiment, and status (queued / running / done / failed)
- `overrides` — PM actions with actor, action type, and full payload for audit

Indexed for priority-ordered queue retrieval and chronological audit across all three tables.

### Cloudflare Workers AI

Model: `@cf/meta/llama-3.1-8b-instruct`

Each feedback item is analysed for:

- Sentiment (negative / neutral / positive)
- Severity signal (1–5)
- Business risk assessment (1–5)
- Keywords and plain-language explanation

A composite priority score is calculated from these signals and stored for queue ordering.

The same model powers an AI chat assistant that answers context-aware queries against live queue data.

### Cloudflare Workflows

AI analysis runs asynchronously via `AnalyzeFeedbackWorkflow` to avoid HTTP timeouts. The workflow:

1. Fetches feedback from D1
2. Calls Workers AI with a structured prompt
3. Parses the AI response to extract signals
4. Calculates a priority score
5. Writes results back to D1

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| AI | Cloudflare Workers AI (Llama 3.1 8B) |
| Async processing | Cloudflare Workflows |
| Language | TypeScript |
| Testing | Vitest |
| Config | Wrangler |

---

## Getting Started

```bash
git clone https://github.com/snig-17/triage-queue
cd triage-queue
npm install
```

Create your D1 database and apply the schema:

```bash
wrangler d1 create triage-queue
wrangler d1 execute triage-queue --file=schema.sql
```

Update `wrangler.jsonc` with your D1 database ID, then run locally:

```bash
wrangler dev
```

Deploy to Cloudflare:

```bash
wrangler deploy
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/feedback` | Submit a new feedback item |
| POST | `/seed` | Seed the database with test data |
| POST | `/analyze/:feedbackId` | Trigger AI analysis for a specific item |
| GET | `/queue` | Retrieve the prioritised analysis queue |
| POST | `/overrides` | Submit a PM override action (approve / reject / rerun / set_status) |
| POST | `/chat` | Query the AI assistant against live queue data |

---

## Product Insights

Three product issues were discovered and documented during development as part of the PM assignment, each with a structured problem statement and actionable suggestion for Cloudflare's team.

### 1. GitHub Integration Failure on Cloudflare Pages

**Problem:** Setting up automatic builds from GitHub produced an opaque error ("There is an internal issue with your Cloudflare Pages Git installation") with no recovery path other than contacting support. The fix — removing and reinstalling the GitHub extension — was not surfaced anywhere in the UI.

**Suggestion:** Specific error messages with actionable fixes. Add a guided "Remove & Reconnect GitHub" button with step-by-step reinstall instructions inline.

### 2. Seeded Feedback Not Auto-Analysed

**Problem:** After seeding 20 test items via `/seed`, each required a manual `curl -X POST /analyze/:feedbackId` call to trigger real AI analysis. With ~30s per item, populating a realistic test dataset took 10+ minutes, making rapid UI iteration painful.

**Suggestion:** Add an optional query parameter to `/seed` (e.g. `?analyze=true`) that auto-triggers analysis on all seeded items, enabling one-command test setup.

### 3. No Workflow Execution Dashboard

**Problem:** Debugging async workflow failures required adding `console.log` statements throughout and checking terminal output. There was no way to view workflow status, execution history, or error details in the Cloudflare dashboard.

**Suggestion:** A Workflows tab in the Cloudflare dashboard (similar to the existing Functions tab for Workers) showing execution history with status, duration, and triggered timestamp — plus clickable rows with step-level logs and a retry button.

---

## Vibe Coding Context

Built using Windsurf as the primary IDE with Claude Sonnet 4.5 for scaffolding — generating the initial project structure, API routes, D1 queries, and the lightweight `/app` UI. Google Antigravity (also Claude Sonnet 4.5) was used for targeted debugging of routing and build issues without refactoring working code.
