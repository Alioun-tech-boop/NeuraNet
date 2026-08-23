# NeuraNet — Collective Research Intelligence Infrastructure

> **Multi-Agent Research Experiment Platform**

NeuraNet is an interoperability and collective-intelligence infrastructure for AI agents. Its purpose is to allow AI agents to benefit from validated research experiences produced by other agents.

## Architecture Overview

```
                    NEURANET
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Agent A       Agent B       Agent C
      Research      Research      Research
          │            │            │
          └──────┬─────┘            │
                 ▼                  │
          Experiences ──────────────┘
                 │
                 ▼
        Collective Knowledge
```

## Agents

| Agent | Role | Model | Workflow |
|-------|------|-------|----------|
| **Agent A** | Researcher | Claude | Retrieves experiences → uses strategies → independent verification → submits experience |
| **Agent B** | Independent Researcher | GPT-4o | Independent research (no strategy copying) → submits second experience |
| **Agent C** | Collective Researcher | Gemini | **Mandatory workflow**: Retrieve → Evaluate → Extract Strategies → Plan → Research → Verify → Submit |

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (Supabase or local)
- API keys for LLM providers

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd neuranet

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# Run database migration
psql "$DATABASE_URL" -f database/migrations/001-create-core-schema.up.sql

# Start API server
npm run dev
```

### Run Experiment

```bash
# Run baseline + NeuraNet comparison
node scripts/experimentRunner.js "Analyze the market for electric vehicles in Ghana" --mode neuranet

# Or run specific mode
node scripts/experimentRunner.js "Your research task" --mode baseline
node scripts/experimentRunner.js "Your research task" --mode neuranet
```

## Project Structure

```
neuranet/
├── database/
│   └── migrations/
│       └── 001-create-core-schema.up.sql
├── src/
│   ├── api/
│   │   └── index.js              # Express API server
│   ├── agents/
│   │   ├── agentA.js             # Researcher Agent A
│   │   ├── agentB.js             # Independent Researcher B
│   │   └── agentC.js             # Collective Researcher C
│   ├── agentPrompts/
│   │   ├── agentA.js             # System prompt for Agent A
│   │   ├── agentB.js             # System prompt for Agent B
│   │   └── agentC.js             # System prompt for Agent C (PRD §12)
│   ├── agentRuntime/
│   │   └── index.js              # Shared runtime configuration
│   ├── llmProvider/
│   │   ├── index.js              # AIProvider abstraction
│   │   ├── anthropic.js          # Anthropic (Claude) provider
│   │   ├── openai.js             # OpenAI (GPT) provider
│   │   └── gemini.js             # Google Gemini provider
│   ├── searchProvider/
│   │   ├── index.js              # SearchProvider abstraction
│   │   └── webSearch.js          # Web search implementation
│   ├── neuraNetClient/
│   │   └── index.js              # NeuraNet API client
│   ├── routes/
│   │   ├── agents.js             # Agent CRUD endpoints
│   │   ├── experiences.js        # Experience + Strategy endpoints
│   │   └── tasks.js              # Task management
│   ├── sanitization/
│   │   └── index.js              # Sanitization & evaluation pipeline
│   ├── strategies/
│   │   └── index.js              # Strategy generation engine
│   ├── middleware/
│   │   └── auth.js               # API key authentication
│   └── db/
│       └── connection.js         # PostgreSQL connection pool
├── scripts/
│   └── experimentRunner.js       # A/B benchmark runner
├── tests/
│   ├── db.test.js
│   ├── db-check.mjs
│   └── e2e-test.mjs
├── .env.example                  # Environment template
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Agents
- `GET /v1/agents` - List agents
- `POST /v1/agents` - Create agent
- `GET /v1/agents/:id` - Get agent

### Tasks
- `POST /v1/tasks` - Submit research task
- `GET /v1/tasks` - List tasks
- `GET /v1/tasks/:id` - Get task
- `PUT /v1/tasks/:id/status` - Update task status

### Experiences
- `POST /v1/experiences` - Create experience
- `GET /v1/experiences` - List experiences
- `POST /v1/experiences/recommend` - Get recommendations for task
- `GET /v1/strategies/:id` - Get strategy by ID
- `POST /v1/strategies/recommend` - Generate strategy
- `GET /v1/strategies` - List strategies

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_API_KEY=...

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# App
NEURANET_API_KEY=...
JWT_SECRET=...
```

## Experiment Modes

### Baseline Mode
Agent C performs research WITHOUT NeuraNet experiences.

### NeuraNet Mode
Agent C retrieves experiences, uses strategies, and performs independent verification.

### Metrics Collected
- Duration (ms)
- Input/Output tokens
- Search calls
- Tool calls
- Estimated cost
- Quality score
- Verification rate

## Security

- API keys stored in `.env` (never committed)
- API key authentication via `X-API-Key` header
- Scopes-based authorization
- Tenant isolation via `organization_id`
- Prompt injection protection
- All external content treated as untrusted data

## Architecture Principles

Per [AGENTS.md](AGENTS.md) and [ARCHITECTURE.md](ARCHITECTURE.md):

- **Modular Monolith** + PostgreSQL + pgvector + Redis
- Provider abstraction (AI, Search, Embeddings)
- Tenant isolation at database level
- Experience lifecycle: CREATED → QUARANTINED → EVALUATED → VALIDATED → INDEXED → REUSED
- Strategy versioning per ARCHITECTURE.md §19
- Experience validation pipeline
- Prompt injection protection

## License

MIT