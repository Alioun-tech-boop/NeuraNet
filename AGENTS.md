# NeuraNet — AGENTS.md

> Instructions for AI coding agents working on the NeuraNet codebase.

---

## 1. Mission

You are an AI software engineering agent working on **NeuraNet**.

NeuraNet is an interoperability and collective-intelligence infrastructure for AI agents.

Its purpose is to allow AI agents to benefit from validated research experiences produced by other agents.

The fundamental loop is:

    AI Agent
        ↓
    Task
        ↓
    NeuraNet
        ↓
    Experience Retrieval
        ↓
    Strategy Generation
        ↓
    AI Research
        ↓
    Outcome
        ↓
    Evaluation
        ↓
    Validated Experience
        ↓
    Collective Knowledge

Your responsibility is not simply to write code.

Your responsibility is to build this system while preserving:

- interoperability;
- collective experience reuse;
- security;
- privacy;
- provenance;
- trust;
- reliability;
- scalability;
- measurable efficiency.

---

# 2. Source of Truth

Before implementing a feature, read the relevant documentation.

Priority order:

    1. PRD.md
    2. ARCHITECTURE.md
    3. ARCHITECTURE-ESSENTIALS.md
    4. Relevant domain documentation
    5. Existing code
    6. Tests

If two documents appear to conflict:

1. identify the conflict;
2. do not silently choose an interpretation;
3. preserve the stricter security/privacy requirement;
4. update the documentation or request an architectural decision.

Never invent a major architectural rule silently.

---

# 3. Core Principle

The central product concept is:

> NeuraNet allows one AI agent to benefit from the validated research experience of other AI agents without requiring direct agent-to-agent coupling.

Do not accidentally turn NeuraNet into:

- a generic chatbot;
- a traditional search engine;
- a simple vector database;
- a collection of AI APIs;
- a raw logging platform.

The reusable **experience** is the core asset.

---

# 4. Before Writing Code

Before implementing a feature:

### Step 1 — Understand the requirement

Identify:

- user/agent problem;
- expected behavior;
- inputs;
- outputs;
- security implications;
- privacy implications;
- persistence requirements;
- performance requirements.

### Step 2 — Inspect the repository

Do not assume the repository structure.

Inspect:

- existing modules;
- package configuration;
- database schema;
- existing services;
- tests;
- environment configuration;
- documentation.

### Step 3 — Identify the architectural boundary

Determine whether the change belongs to:

- API;
- domain;
- application;
- infrastructure;
- database;
- retrieval;
- experience processing;
- trust;
- evaluation;
- provider integration.

### Step 4 — Check existing abstractions

Reuse existing abstractions whenever possible.

Do not create duplicate:

- repositories;
- services;
- provider clients;
- validation systems;
- authentication mechanisms;
- database utilities.

### Step 5 — Plan before modifying

For non-trivial changes, explain internally:

    What changes?
    Why?
    Which modules?
    Which interfaces?
    Which tests?
    Which migrations?
    Which security concerns?

Then implement the smallest correct change.

---

# 5. Do Not Overengineer

The MVP must remain simple.

Preferred architecture:

    Modular Monolith
          +
    PostgreSQL
          +
    pgvector
          +
    Redis
          +
    Object Storage
          +
    Provider Abstractions

Do not introduce microservices unless there is a demonstrated technical requirement.

Do not introduce:

- Kafka;
- Kubernetes;
- distributed databases;
- graph databases;
- blockchain;
- complex agent marketplaces;

just because they may be useful in the future.

Build what is necessary now.

---

# 6. Technology Baseline

Unless explicitly changed by an architectural decision:

### Backend

    Node.js

### Language

    JavaScript

### API

    REST

### Database

    PostgreSQL

### Vector Search

    pgvector

### Cache

    Redis

### Storage

    Object Storage

### Deployment

    Containers

### AI Providers

    Provider abstraction

### Search Providers

    Provider abstraction

---

# 7. JavaScript Rules

Use modern JavaScript.

Prefer:

- `const`;
- `let`;
- async/await;
- ES modules where the project configuration supports them;
- explicit error handling;
- small functions;
- composable modules.

Avoid:

- unnecessary global state;
- deeply nested callbacks;
- hidden side effects;
- giant files;
- giant functions;
- duplicated logic.

Do not introduce TypeScript unless explicitly requested or approved by the project architecture.

---

# 8. Architecture Rules

The preferred dependency direction is:

    API
      ↓
    Application
      ↓
    Domain
      ↓
    Interfaces
      ↓
    Infrastructure

Infrastructure must not leak into the domain layer.

Prefer:

    Domain
       ↓
    Repository Interface
       ↓
    PostgreSQL Adapter

Instead of:

    Domain
       ↓
    PostgreSQL Client

The same principle applies to:

- AI providers;
- search providers;
- embeddings;
- object storage;
- queues.

---

# 9. Provider Abstraction

Never hard-code NeuraNet around one provider.

The system must support:

    AI Provider
        ├── Provider A
        ├── Provider B
        ├── Provider C
        └── Future Provider

Likewise:

    Search Provider
        ├── Provider A
        ├── Provider B
        └── Future Provider

Provider-specific implementation belongs in adapters.

The domain must depend on interfaces, not providers.

---

# 10. Agent Interoperability

Agents must communicate with NeuraNet through a stable interface.

The architecture should support different agent types:

- autonomous agents;
- research agents;
- coding agents;
- enterprise agents;
- personal assistants;
- future AI systems.

Do not assume that every agent uses the same model, provider or framework.

---

# 11. Agent Identity

Every registered agent should have a stable identity.

Conceptually:

    Agent
      ├── id
      ├── owner
      ├── organization
      ├── capabilities
      ├── metadata
      ├── status
      └── trust information

Agent identity must be separate from model identity.

An agent is not simply:

    "GPT-X"

It is an entity capable of performing tasks.

---

# 12. Agent Capabilities

Capabilities should be explicit where possible.

Examples:

    web_research
    coding
    financial_analysis
    mathematical_reasoning
    document_analysis
    data_analysis

Do not assume capabilities from a model name alone.

---

# 13. Task Normalization

Raw agent requests should be normalized before retrieval.

Conceptually:

    Raw Task
       ↓
    Validation
       ↓
    Normalization
       ↓
    Task Representation
       ↓
    Retrieval

Normalization may include:

- objective;
- domain;
- constraints;
- required freshness;
- desired output;
- risk level;
- language;
- available tools.

The normalized task should be reusable for retrieval.

---

# 14. Experience Is the Primary Knowledge Unit

An experience is not merely an answer.

It represents a useful research process or outcome.

An experience may contain:

    task
    strategy
    queries
    sources
    tool usage
    intermediate findings
    failures
    outcome
    verification
    confidence
    trust
    provenance
    timestamps

Do not store massive raw conversations when a compact reusable experience can be extracted.

---

# 15. Experience Lifecycle

Use a lifecycle similar to:

    CREATED
       ↓
    SANITIZED
       ↓
    QUARANTINED
       ↓
    EVALUATED
       ↓
    VALIDATED
       ↓
    INDEXED
       ↓
    REUSED

Potential later states:

    SUSPENDED
    DEPRECATED
    REJECTED

Never bypass validation for collective knowledge unless explicitly authorized by the architecture.

---

# 16. Privacy

Default visibility:

    PRIVATE

Possible visibility:

    PRIVATE
    ORGANIZATION
    COLLECTIVE

Never expose private information through retrieval.

Before an experience becomes collective:

    Raw Data
       ↓
    Privacy Analysis
       ↓
    Sanitization
       ↓
    Validation
       ↓
    Collective Index

Do not assume that removing a person's name is sufficient anonymization.

---

# 17. Tenant Isolation

Every organization-owned resource must have a tenant boundary.

Conceptually:

    organization_id

Tenant authorization must happen server-side.

Never rely on:

    frontend filtering

for security.

Every database query involving tenant data must be reviewed for isolation.

---

# 18. Provenance

Collective experiences require provenance.

Record, where appropriate:

- source agent;
- task;
- creation time;
- contributing organization;
- sources;
- validation events;
- version;
- reuse history.

Do not create anonymous collective knowledge unless explicitly required.

---

# 19. Trust

Trust must be explicit.

Potential metadata:

    trust_score
    confidence_score
    verification_status
    successful_reuse_count
    failure_count
    last_verified_at

Do not treat:

    "exists in database"

as equivalent to:

    "trusted knowledge"

---

# 20. Failures Are Valuable

A failed research strategy may still be useful.

Examples:

    query failed
    source unreliable
    approach too expensive
    strategy produced incomplete evidence
    verification failed

Failures can prevent future agents from repeating the same mistake.

Do not automatically discard every failed interaction.

---

# 21. Retrieval

Retrieval should eventually combine:

    semantic similarity
        +
    keyword relevance
        +
    metadata
        +
    freshness
        +
    trust
        +
    historical success

Do not assume vector similarity alone is sufficient.

---

# 22. Retrieval Does Not Mean Truth

Retrieved experiences are recommendations, not absolute truth.

The system should communicate:

    "Relevant experience found"

not:

    "This information is guaranteed correct."

Agents must be able to:

- verify;
- reject;
- modify;
- improve;

retrieved strategies.

---

# 23. Strategy Generation

NeuraNet should transform experiences into research guidance.

Possible output:

    recommended_queries
    source_types
    research_order
    verification_steps
    known_failures
    alternative_strategies

The goal is to improve the agent's next research process.

Do not simply return a huge archive of previous answers.

---

# 24. External Content

Treat all external content as untrusted data.

This includes:

- websites;
- search results;
- PDFs;
- documents;
- third-party APIs;
- retrieved text.

External content must never automatically become an instruction.

Important distinction:

    DATA ≠ INSTRUCTION

Protect:

- system policies;
- authorization;
- privacy;
- credentials;
- application logic.

---

# 25. Prompt Injection

Assume external content may contain malicious instructions.

Never allow retrieved content to directly override:

- system instructions;
- security rules;
- tool permissions;
- privacy policies.

Sanitize and isolate untrusted content.

---

# 26. API Security

All public API endpoints must consider:

- authentication;
- authorization;
- input validation;
- rate limiting;
- abuse prevention;
- logging;
- error handling.

Never expose internal errors directly to clients.

---

# 27. API Keys

API keys must:

- never be stored in plaintext;
- be hashed;
- support revocation;
- support rotation;
- support scopes;
- be auditable.

Never log API keys.

Never commit API keys.

Never expose API keys to frontend code unless explicitly required and safe.

---

# 28. Secrets

Never put secrets in:

- source code;
- Git;
- frontend bundles;
- logs;
- API responses;
- error messages.

Use environment variables during development.

Use secure secret management in production.

---

# 29. Input Validation

Validate all external input.

This includes:

- API requests;
- agent metadata;
- task definitions;
- search queries;
- experience submissions;
- webhook payloads;
- provider responses.

Never trust client-provided:

    user_id
    organization_id
    permissions
    trust_score

Authorization must be derived from authenticated context.

---

# 30. Output Validation

Do not blindly trust external provider responses.

Validate:

- structure;
- required fields;
- size;
- type;
- status;
- expected content.

Provider failures must not silently create corrupted knowledge.

---

# 31. Database

PostgreSQL is the initial source of truth.

Use it for:

- users;
- organizations;
- agents;
- tasks;
- experiences;
- strategies;
- sources;
- evaluations;
- trust;
- audit logs.

Use pgvector for semantic retrieval.

---

# 32. Redis

Redis is supporting infrastructure.

Use Redis for:

- caching;
- rate limiting;
- temporary state;
- short-lived coordination.

Do not use Redis as the authoritative knowledge database.

---

# 33. Asynchronous Work

Long-running tasks should be asynchronous.

Examples:

- embedding generation;
- experience extraction;
- large document processing;
- evaluation;
- indexing.

Preferred pattern:

    API
      ↓
    Queue
      ↓
    Worker
      ↓
    Processing
      ↓
    Database

Do not block an HTTP request for expensive operations unnecessarily.

---

# 34. Idempotency

Important write operations should support idempotency where appropriate.

This protects against:

- retries;
- duplicate requests;
- network failures;
- provider timeouts.

Repeated requests must not unintentionally create duplicate experiences or transactions.

---

# 35. Observability

Production code should provide:

- structured logs;
- request IDs;
- metrics;
- error tracking;
- latency monitoring;
- provider usage metrics.

Avoid logging sensitive information.

---

# 36. Cost Tracking

Track AI infrastructure consumption.

Potential metrics:

    model_calls
    input_tokens
    output_tokens
    search_calls
    embedding_calls
    estimated_cost
    latency

NeuraNet must be able to measure:

    Research without NeuraNet

versus:

    Research with NeuraNet

---

# 37. Energy Efficiency

Do not claim that NeuraNet saves energy without measurements.

Track measurable proxies:

- token reduction;
- search reduction;
- tool-call reduction;
- model-call reduction;
- compute reduction.

Later, energy consumption can be benchmarked directly where reliable measurements are available.

---

# 38. Benchmarking

The core hypothesis must be experimentally testable.

Every major retrieval or strategy feature should eventually have benchmarks.

At minimum compare:

    WITHOUT NEURANET

and:

    WITH NEURANET

Measure:

    accuracy
    research quality
    search count
    tool calls
    token usage
    latency
    cost
    verification rate

---

# 39. Tests

Every significant feature requires tests.

Prefer:

    Unit Tests
        ↓
    Integration Tests
        ↓
    API Tests
        ↓
    End-to-End Tests

Critical security and privacy paths must have dedicated tests.

---

# 40. Test Philosophy

Tests should verify behavior, not implementation details.

Good:

    "private experience cannot be retrieved by another organization"

Bad:

    "function X calls function Y three times"

unless the interaction itself is an architectural requirement.

---

# 41. Database Migrations

Never manually modify production database schemas.

Use versioned migrations.

Every schema change must include:

- migration;
- rollback strategy where practical;
- affected tests;
- documentation if behavior changes.

---

# 42. Backward Compatibility

Public APIs should remain backward-compatible within a version.

Breaking changes require:

- versioning;
- migration plan;
- documentation.

Do not silently change API contracts.

---

# 43. Error Handling

Errors should be:

- explicit;
- typed/classified;
- observable;
- safe for clients.

Do not swallow exceptions.

Do not return:

    200 OK

for failed operations.

Use appropriate HTTP status codes.

---

# 44. Logging

Logs must help diagnose problems without exposing sensitive information.

Never log:

- passwords;
- API keys;
- authentication tokens;
- private research content;
- confidential user data.

Prefer structured events.

Example:

    {
      "event": "experience.retrieved",
      "request_id": "...",
      "agent_id": "...",
      "count": 8
    }

---

# 45. Performance

Do not prematurely optimize.

First:

    Correctness
        ↓
    Security
        ↓
    Reliability
        ↓
    Measurement
        ↓
    Optimization

Optimize based on evidence.

---

# 46. Caching

Cache only data that is safe to cache.

Consider:

- task normalization;
- embeddings;
- search results;
- frequently retrieved experiences;
- provider metadata.

Never allow cached private data to leak across tenants.

Cache keys must include appropriate tenant/security boundaries.

---

# 47. Concurrency

Assume concurrent requests.

Protect against:

- duplicate experience creation;
- race conditions;
- inconsistent trust updates;
- duplicate indexing;
- concurrent state transitions.

Use:

- database constraints;
- transactions;
- unique indexes;
- optimistic/pessimistic locking where appropriate.

---

# 48. State Transitions

Important domain states must have controlled transitions.

Example:

    QUARANTINED
        ↓
    EVALUATED
        ↓
    VALIDATED

Do not allow arbitrary status updates from the API.

The domain should enforce valid transitions.

---

# 49. Collective Knowledge Protection

Assume attackers may attempt to poison collective knowledge.

Potential attack:

    malicious agent
        ↓
    fake experience
        ↓
    collective index
        ↓
    future agents
        ↓
    incorrect research

Defenses should include:

- provenance;
- validation;
- reputation;
- anomaly detection;
- contribution limits;
- independent verification;
- rollback.

---

# 50. No Blind Self-Learning

Never implement:

    Every successful interaction
        ↓
    Automatically trusted knowledge

Instead:

    Interaction
        ↓
    Extraction
        ↓
    Sanitization
        ↓
    Evaluation
        ↓
    Validation
        ↓
    Knowledge

---

# 51. Source Intelligence

Sources may eventually have reputation metadata.

Examples:

    source_quality
    domain_relevance
    freshness
    historical_success
    verification_rate

Do not confuse source reputation with truth.

Source reputation is a signal, not a guarantee.

---

# 52. Freshness

Knowledge must have timestamps.

Do not apply one universal freshness rule.

Examples:

    Financial information
        → highly time-sensitive

    Software libraries
        → version-sensitive

    Mathematical principles
        → generally stable

Freshness must be domain-aware.

---

# 53. Agent Autonomy

NeuraNet recommends.

It does not command.

Agents should be able to:

- accept a strategy;
- reject a strategy;
- modify a strategy;
- verify information;
- submit feedback.

Never design the system assuming retrieved knowledge is mandatory.

---

# 54. Graceful Degradation

If NeuraNet becomes unavailable:

    Agent
      ↓
    NeuraNet unavailable
      ↓
    Agent performs independent research

NeuraNet should improve agents without becoming a single point of failure.

---

# 55. Provider Failures

External providers can fail.

Handle:

- timeouts;
- retries;
- exponential backoff;
- circuit breakers;
- fallback providers where available.

Never convert provider failure into fake knowledge.

---

# 56. Security Priority

When choosing between two implementations:

    Security
       ↓
    Privacy
       ↓
    Data Integrity
       ↓
    Reliability
       ↓
    Performance
       ↓
    Cost

Never sacrifice security for convenience.

---

# 57. Dependency Management

Before adding a dependency:

1. check whether the functionality already exists;
2. evaluate maintenance status;
3. evaluate security;
4. evaluate package size;
5. evaluate licensing;
6. determine whether the dependency is actually necessary.

Avoid dependency bloat.

---

# 58. No Duplicate Systems

Before creating a new:

- utility;
- service;
- repository;
- validation helper;
- provider client;

search the repository first.

If an equivalent abstraction exists, extend it rather than duplicating it.

---

# 59. Naming

Use descriptive names.

Prefer:

    ExperienceRepository
    ExperienceValidator
    RetrievalService
    StrategyGenerator
    TrustService

Avoid:

    DataManager
    Helper
    Utils
    Misc
    Temp

unless the purpose is genuinely generic.

---

# 60. File Size

Avoid excessively large files.

If a module becomes difficult to understand:

    identify responsibility
        ↓
    extract cohesive component
        ↓
    preserve clear interfaces

Do not split files artificially just to reduce line count.

---

# 61. Comments

Comments should explain:

- why;
- constraints;
- architectural decisions;
- security considerations;
- non-obvious behavior.

Do not write comments that simply restate the code.

Bad:

    // Increment counter
    counter++;

Good:

    // Prevent duplicate indexing when provider retries the same event.
    if (existingIndex) return;

---

# 62. Documentation

When behavior changes significantly, update the relevant documentation.

At minimum consider:

    PRD.md
    ARCHITECTURE.md
    ARCHITECTURE-ESSENTIALS.md
    API.md
    DATABASE.md
    EXPERIENCE_SCHEMA.md

Do not let code and architecture documentation diverge.

---

# 63. Architecture Decision Records

For significant architectural changes create an ADR.

Location:

    /docs/adr/

Format:

    ADR-NNN-title.md

Include:

    Context
    Decision
    Alternatives
    Consequences

Examples:

    ADR-001-modular-monolith.md
    ADR-002-provider-abstraction.md
    ADR-003-experience-trust.md

---

# 64. Git Discipline

Commits should be:

- focused;
- understandable;
- logically grouped.

Avoid mixing:

    feature
    refactoring
    formatting
    unrelated fixes

in one commit.

Prefer small coherent commits.

---

# 65. Never Commit Secrets

Before committing, verify:

    .env
    API keys
    credentials
    tokens
    certificates
    private configuration

are not accidentally staged.

Maintain:

    .env.example

with placeholders only.

---

# 66. Environment Configuration

Configuration must be environment-aware.

Typical environments:

    development
    test
    staging
    production

Do not hard-code production URLs, credentials or secrets.

---

# 67. Production Safety

Never execute destructive production operations without explicit authorization.

Be especially careful with:

- database deletion;
- migrations;
- data cleanup;
- user deletion;
- collective knowledge deletion;
- index rebuilding.

Prefer reversible operations.

---

# 68. Data Deletion

When deleting knowledge:

- verify authorization;
- preserve audit information where legally/architecturally appropriate;
- remove search indexes;
- invalidate caches;
- handle derived artifacts.

Deleting a database row is not necessarily enough.

---

# 69. Auditability

Security-sensitive actions should be auditable.

Examples:

    API key created
    API key revoked
    agent registered
    experience submitted
    experience validated
    experience suspended
    organization access changed

Audit logs must not contain secrets.

---

# 70. AI Agent Safety

AI-generated code must be treated like human-generated code.

Never assume:

    "The AI wrote it, therefore it is correct."

Review:

- security;
- privacy;
- correctness;
- race conditions;
- failure handling;
- test coverage.

---

# 71. Working With AI-Generated Code

When modifying existing AI-generated code:

1. understand it;
2. identify assumptions;
3. verify dependencies;
4. test behavior;
5. improve architecture if necessary.

Do not blindly layer new code on top of poor abstractions.

---

# 72. Do Not Rewrite Unnecessarily

If the existing implementation works:

    improve incrementally.

Do not rewrite an entire module simply because another implementation looks cleaner.

Large rewrites increase regression risk.

---

# 73. Refactoring Rule

Refactoring is allowed when it:

- reduces complexity;
- improves correctness;
- improves testability;
- removes duplication;
- strengthens architectural boundaries.

Refactoring must preserve behavior unless behavior change is explicitly intended.

---

# 74. Feature Completion Checklist

Before declaring a feature complete:

### Functional

- [ ] Requirement implemented
- [ ] Edge cases handled
- [ ] Errors handled
- [ ] Existing behavior preserved

### Security

- [ ] Authentication considered
- [ ] Authorization considered
- [ ] Input validated
- [ ] Sensitive data protected
- [ ] Tenant isolation verified

### Data

- [ ] Schema changes migrated
- [ ] Constraints added
- [ ] Indexes considered
- [ ] Data lifecycle considered

### Tests

- [ ] Unit tests
- [ ] Integration tests where necessary
- [ ] Security tests where necessary
- [ ] Regression tests

### Observability

- [ ] Errors observable
- [ ] Important operations traceable
- [ ] No sensitive data in logs

### Documentation

- [ ] Relevant documentation updated
- [ ] ADR created if necessary

---

# 75. Before Final Response

After implementing a task:

1. run tests;
2. run linting if configured;
3. verify database migrations;
4. inspect changed files;
5. check for accidental secrets;
6. verify API contracts;
7. verify tenant boundaries;
8. verify no unnecessary dependencies were introduced.

Then report:

    What changed
    Why
    Tests executed
    Known limitations
    Remaining work

Never claim a test passed if it was not actually executed.

---

# 76. If Something Is Unclear

Do not invent product behavior.

If the ambiguity affects:

- security;
- privacy;
- data model;
- public API;
- trust;
- architecture;

stop and identify the ambiguity.

For low-risk implementation details, choose the simplest approach consistent with the existing architecture.

---

# 77. Priority During Conflicts

When requirements conflict, use this priority:

    1. Security
    2. Privacy
    3. Data integrity
    4. Explicit product requirements
    5. Architecture rules
    6. Reliability
    7. Performance
    8. Cost
    9. Developer convenience

Developer convenience must never override security or product integrity.

---

# 78. Definition of Done

A feature is not done simply because:

    "the code works."

It is done when:

    Requirement
        +
    Correct implementation
        +
    Security
        +
    Privacy
        +
    Tests
        +
    Observability
        +
    Documentation
        +
    Architectural consistency

are satisfied.

---

# 79. NeuraNet's Core Invariant

The following invariant must never be lost:

> Knowledge produced by one AI agent should be capable of becoming validated, privacy-safe, provenance-aware and reusable experience for another AI agent.

Every major architectural decision should be evaluated against this invariant.

---

# 80. Final Rule

Build NeuraNet incrementally.

Do not optimize for architectural complexity.

Optimize for proving the core hypothesis:

    Can collective research experience
    make AI agents better at future research?

The first objective is not to build the largest AI infrastructure.

The first objective is to build the smallest reliable system capable of proving that hypothesis.

Once proven, scale the architecture around measured evidence.

---

# 81. Agent Instruction

When working on this repository:

    READ
      ↓
    UNDERSTAND
      ↓
    PLAN
      ↓
    IMPLEMENT
      ↓
    TEST
      ↓
    SECURITY REVIEW
      ↓
    DOCUMENT
      ↓
    REPORT

Never skip directly from:

    REQUEST → CODE

The quality of NeuraNet depends as much on architectural discipline as on implementation speed.