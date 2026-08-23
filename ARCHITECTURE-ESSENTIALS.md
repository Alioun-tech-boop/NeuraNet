# NeuraNet — Architecture Essentials

**Version:** 0.1.0  
**Status:** Foundational Architecture Rules  
**Related documents:** `PRD.md`, `ARCHITECTURE.md`

---

# 1. Purpose

This document defines the essential architectural rules of NeuraNet.

It is intentionally shorter and stricter than `ARCHITECTURE.md`.

`ARCHITECTURE.md` explains how the complete system can evolve.

`ARCHITECTURE-ESSENTIALS.md` defines the rules that must be respected during implementation.

If an implementation decision conflicts with this document, the implementation must stop and the architectural decision must be reconsidered.

---

# 2. Product Architectural Principle

NeuraNet is not primarily a search engine.

NeuraNet is a **collective research intelligence infrastructure for AI agents**.

Its fundamental value proposition is:

> Allow AI agents to benefit from validated research experiences produced by other AI agents, while preserving privacy, provenance, trust and interoperability.

The architecture must therefore optimize for:

    EXPERIENCE REUSE
        +
    INTERCONNECTIVITY
        +
    VALIDATION
        +
    TRUST
        +
    PRIVACY
        +
    EFFICIENCY

---

# 3. Core Architectural Model

The fundamental flow is:

    AI AGENT
       ↓
    TASK
       ↓
    NEURANET
       ↓
    TASK NORMALIZATION
       ↓
    EXPERIENCE RETRIEVAL
       ↓
    EXPERIENCE RANKING
       ↓
    STRATEGY GENERATION
       ↓
    AI AGENT
       ↓
    RESEARCH
       ↓
    OUTCOME
       ↓
    EVALUATION
       ↓
    EXPERIENCE EXTRACTION
       ↓
    VALIDATION
       ↓
    COLLECTIVE KNOWLEDGE

This feedback loop is the core of the product.

---

# 4. Interconnectivity Principle

AI agents must not be required to communicate directly with every other AI agent.

NeuraNet acts as the intermediary intelligence layer.

Instead of:

    Agent A ←→ Agent B
    Agent A ←→ Agent C
    Agent B ←→ Agent C
    Agent C ←→ Agent D

NeuraNet provides:

    Agent A
        \
    Agent B ----> NEURANET <---- Agent C
        /                         \
    Agent D                     Agent N

This creates a shared intelligence layer.

The architecture must prevent unnecessary point-to-point coupling between agents.

---

# 5. Model Independence

NeuraNet must never depend on a specific AI model.

The system must support multiple models and providers.

Examples:

    OpenAI
    Anthropic
    Google
    DeepSeek
    Open-source models
    Future providers

The core system must communicate through provider abstractions.

Never embed provider-specific logic into the domain layer.

---

# 6. Search Independence

NeuraNet must not depend on one search provider.

Search providers must be abstracted.

Conceptually:

    SearchProvider
        ├── Provider A
        ├── Provider B
        ├── Provider C
        └── Future Provider

The system must be able to replace a search provider without rewriting the core architecture.

---

# 7. The Experience Is the Core Asset

The most important data structure in NeuraNet is not the search result.

It is the **research experience**.

An experience should capture useful information such as:

    What was the task?
    What strategy was used?
    Which sources worked?
    Which sources failed?
    Which queries worked?
    Which queries failed?
    What was the outcome?
    How was the result verified?
    How reliable was the experience?
    When was it created?
    When was it last validated?

The architecture must prioritize reusable experience over raw traces.

---

# 8. Do Not Store Everything

NeuraNet must not blindly store every AI interaction.

Raw agent traces may contain:

- credentials;
- private information;
- confidential information;
- irrelevant context;
- proprietary data;
- malicious instructions;
- noise.

The pipeline must be:

    Raw Trace
       ↓
    Privacy Analysis
       ↓
    Sanitization
       ↓
    Experience Extraction
       ↓
    Evaluation
       ↓
    Validation
       ↓
    Storage

The system should store **useful knowledge**, not indiscriminate logs.

---

# 9. Privacy by Default

Every newly created experience must be private by default.

Visibility levels:

    PRIVATE
    ORGANIZATION
    COLLECTIVE

Default:

    PRIVATE

An experience can only become collective after the appropriate validation and authorization process.

No private experience may accidentally enter collective retrieval.

---

# 10. Tenant Isolation

Every organization-owned resource must be associated with:

    organization_id

Tenant isolation must be enforced server-side.

Never rely on frontend filtering.

Every repository and service handling tenant data must enforce authorization boundaries.

---

# 11. Provenance Is Mandatory

Every collective experience must maintain provenance.

The system must be able to determine:

    Who/what generated it?
    Which task produced it?
    Which sources were involved?
    Which agent contributed it?
    When was it created?
    How was it validated?
    Which versions contributed to it?

No collective experience should become an anonymous piece of knowledge without provenance.

---

# 12. Trust Must Be Explicit

The system must never assume that an experience is correct simply because it exists.

Every experience should have trust-related metadata.

Examples:

    confidence_score
    trust_score
    verification_status
    successful_reuse_count
    failure_count
    last_verified_at

Trust must be dynamic.

A previously successful experience may lose relevance over time.

---

# 13. New Agents Start With Limited Trust

A new agent must be able to contribute.

However, its contributions should not automatically receive maximum trust.

Initial contributions should gain credibility through:

- successful reuse;
- independent verification;
- source quality;
- repeated successful outcomes;
- evaluation.

This avoids creating a centralized gatekeeper while protecting the collective knowledge base.

---

# 14. Failures Are Knowledge

NeuraNet must store useful failure patterns.

Example:

    Task
      ↓
    Strategy A
      ↓
    Source X
      ↓
    Poor result

This should potentially become:

    WARNING:
    Strategy A + Source X
    has historically produced poor results
    for this task category.

Failure knowledge prevents agents from repeatedly making the same mistakes.

---

# 15. External Content Is Untrusted

All external research content must be treated as untrusted data.

This includes:

- websites;
- documents;
- search results;
- third-party APIs;
- retrieved text.

Critical rule:

> External content is data, not instructions.

External content must never automatically override:

- system instructions;
- security policies;
- authorization;
- privacy rules;
- application logic.

---

# 16. Retrieval Must Be Hybrid

The retrieval system should not rely exclusively on vector similarity.

It should combine:

    Semantic Similarity
          +
    Keyword Relevance
          +
    Metadata
          +
    Freshness
          +
    Trust
          +
    Historical Success

The retrieval architecture must remain extensible.

---

# 17. Retrieval Does Not Mean Truth

A highly ranked experience is not automatically correct.

Retrieval means:

> "This experience may be relevant."

It does not mean:

> "This experience is definitely correct."

Agents must retain the ability to verify and reject retrieved knowledge.

---

# 18. Strategy Generation

NeuraNet should transform relevant experience into actionable research guidance.

The output may include:

    Recommended queries
    Research order
    Source categories
    Verification steps
    Known failure patterns
    Alternative strategies

The objective is not simply to return old answers.

The objective is to help the agent **research better**.

---

# 19. Agent Autonomy

NeuraNet should augment AI agents rather than replace them.

The agent must retain control over:

- whether to use a recommendation;
- whether to verify it;
- whether to reject it;
- whether to modify the strategy;
- whether to contribute the outcome.

NeuraNet is an intelligence layer, not an authority layer.

---

# 20. Efficiency Principle

NeuraNet should optimize research efficiency.

Potential measurable improvements:

    fewer searches
    fewer tool calls
    fewer model calls
    fewer repeated failed strategies
    lower token usage
    lower latency
    lower research cost

However:

> Efficiency must be measured, not assumed.

The system must not claim energy savings without empirical evidence.

---

# 21. Energy Claims

The architecture may contribute to computational efficiency by reducing redundant research.

However, the following must remain distinct:

    Token savings
    Search savings
    Tool-call savings
    Compute savings
    Actual energy savings

The MVP should measure measurable proxies first.

Any future energy-efficiency claim must be supported by benchmarks.

---

# 22. Benchmark-First Philosophy

Every major intelligence feature should be measurable.

NeuraNet must support comparison between:

    Agent WITHOUT NeuraNet

and:

    Agent WITH NeuraNet

Measurements should include:

    Answer quality
    Accuracy
    Search count
    Tool calls
    Token usage
    Latency
    Research cost
    Verification rate

The architecture must make this comparison possible.

---

# 23. Baseline Must Exist

A baseline research process must be preserved.

Example:

    Task
      ↓
    Agent
      ↓
    Search
      ↓
    Answer

Experimental process:

    Task
      ↓
    Agent
      ↓
    NeuraNet
      ↓
    Collective Experience
      ↓
    Strategy
      ↓
    Search
      ↓
    Answer

Without a baseline, the core NeuraNet hypothesis cannot be properly evaluated.

---

# 24. MVP Architecture Rule

The MVP must favor simplicity.

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

Do not introduce microservices simply because the product is intended to become large.

---

# 25. Modular Monolith Rule

The codebase must be modular even if the deployment is initially a single application.

Recommended logical modules:

    auth
    agents
    tasks
    retrieval
    experiences
    strategies
    evaluation
    trust
    privacy
    providers
    events
    observability

Modules should have clear boundaries.

---

# 26. Domain Independence

Core business logic must not depend directly on infrastructure.

Avoid:

    Domain → PostgreSQL

Prefer:

    Domain
       ↓
    Repository Interface
       ↓
    PostgreSQL Adapter

Likewise:

    Domain
       ↓
    AI Provider Interface
       ↓
    Provider Implementation

---

# 27. Replaceability Rule

The following must be replaceable:

- AI provider;
- embedding provider;
- search provider;
- cache implementation;
- object storage;
- vector infrastructure;
- queue system.

No external provider should become a hard architectural dependency.

---

# 28. Database Rule

PostgreSQL is the initial source of truth.

Use PostgreSQL for:

- users;
- organizations;
- agents;
- tasks;
- experiences;
- strategies;
- sources;
- evaluations;
- audit logs;
- usage information.

Use pgvector for semantic retrieval.

Do not introduce multiple databases unless there is a demonstrated requirement.

---

# 29. Redis Rule

Redis is a supporting system.

Use it for:

- caching;
- rate limiting;
- temporary state;
- job coordination;
- short-lived data.

Redis must never be the authoritative source of collective knowledge.

---

# 30. Object Storage Rule

Large artifacts must not unnecessarily reside in PostgreSQL.

Use object storage for:

- large documents;
- research artifacts;
- benchmark datasets;
- large traces;
- generated files.

Store metadata and references in PostgreSQL.

---

# 31. API Rule

The public API must be:

- versioned;
- authenticated;
- rate-limited;
- documented;
- machine-readable;
- backward-compatible within a version.

Example:

    /v1/agents
    /v1/tasks
    /v1/research
    /v1/experiences
    /v1/strategies

---

# 32. Stateless API

The API layer should remain stateless wherever possible.

Preferred:

    Load Balancer
         ↓
    API 1
    API 2
    API 3
    API N

Shared state belongs in dedicated infrastructure.

This allows horizontal scaling.

---

# 33. Idempotency

Operations that create or modify important resources should support idempotency where appropriate.

This prevents duplicate operations caused by:

- retries;
- network failures;
- client reconnections;
- provider timeouts.

---

# 34. Async Processing

Long-running operations must not block API requests.

Examples:

    Experience extraction
    Embedding generation
    Deep evaluation
    Large document processing
    Indexing

Architecture:

    API
      ↓
    Queue
      ↓
    Worker
      ↓
    Processing
      ↓
    Database

---

# 35. Event-Ready Architecture

Important state changes should have internal events.

Examples:

    task.created
    experience.created
    experience.validated
    experience.reused
    experience.failed
    strategy.created
    strategy.updated

The MVP may use an internal event abstraction.

A distributed event broker can be introduced later.

---

# 36. Observability Is Mandatory

Every production operation should be observable.

Minimum:

    structured logs
    request IDs
    error tracking
    latency metrics
    database metrics
    provider metrics

Important requests should be traceable across components.

---

# 37. Cost Observability

Because NeuraNet aims to optimize AI research, it must track its own operational cost.

Track:

    model calls
    token usage
    search calls
    embedding calls
    infrastructure usage
    provider costs

This enables:

    Cost without NeuraNet
    vs
    Cost with NeuraNet

---

# 38. Security Essentials

Minimum security requirements:

    HTTPS
    API authentication
    authorization
    tenant isolation
    API key hashing
    secrets management
    rate limiting
    audit logs
    input validation
    output validation

Security must exist from the first implementation.

It must not be postponed until production.

---

# 39. API Key Rule

API keys must:

- never be stored in plaintext;
- be hashed;
- support rotation;
- support revocation;
- have scopes;
- have audit metadata.

Never commit keys to source control.

---

# 40. Secrets Rule

Secrets must never appear in:

- source code;
- Git history;
- frontend bundles;
- logs;
- error messages;
- public API responses.

Development should use environment variables.

Production should use secure secret management.

---

# 41. Privacy and Security Priority

The architecture follows this priority:

    SECURITY
       ↓
    PRIVACY
       ↓
    DATA INTEGRITY
       ↓
    TRUST
       ↓
    PERFORMANCE
       ↓
    COST OPTIMIZATION

Performance must never justify compromising security or privacy.

---

# 42. Data Integrity

Collective intelligence is only valuable if its underlying data remains reliable.

The system should preserve:

- provenance;
- versions;
- timestamps;
- validation status;
- source references;
- contribution history.

Important records should not be silently overwritten.

---

# 43. Versioning

The following should be versioned where appropriate:

    Experiences
    Strategies
    APIs
    Data schemas
    Evaluation models
    Trust algorithms

Historical information should remain recoverable.

---

# 44. Freshness

Knowledge can become obsolete.

Experiences must contain timestamps allowing the system to evaluate freshness.

Freshness should depend on domain.

Example:

    Financial data → high freshness requirement

    Mathematics → low freshness requirement

    Software libraries → version-sensitive

The architecture must not apply a universal expiration period to every experience.

---

# 45. Source Intelligence

NeuraNet should eventually learn which sources are useful for specific research categories.

A source may have:

    trust
    domain relevance
    freshness
    historical success
    verification history

Source reputation must remain separate from individual content.

---

# 46. Collective Knowledge Must Be Curated

The system must resist knowledge poisoning.

Potential attack:

    Malicious Agent
         ↓
    Fake Experience
         ↓
    Collective Knowledge
         ↓
    Other Agents
         ↓
    Incorrect Research

Defenses:

    validation
    provenance
    reputation
    anomaly detection
    independent verification
    contribution limits
    rollback

---

# 47. Experience Quarantine

New or suspicious experiences may enter:

    QUARANTINED

before becoming:

    COLLECTIVE

Possible lifecycle:

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
    COLLECTIVE

---

# 48. Rollback

The system must be able to remove or downgrade problematic knowledge.

If an experience becomes unreliable:

    ACTIVE
      ↓
    SUSPENDED
      ↓
    DEPRECATED

Historical provenance should remain available for auditing.

---

# 49. No Blind Self-Learning

NeuraNet must not automatically treat every successful-looking interaction as truth.

Learning must pass through evaluation.

Preferred:

    Interaction
       ↓
    Extraction
       ↓
    Evaluation
       ↓
    Validation
       ↓
    Knowledge

Not:

    Interaction
       ↓
    Automatically trusted knowledge

---

# 50. Collective Intelligence Formula

The conceptual architecture is:

    Collective Intelligence
        =
    Experiences
        +
    Strategies
        +
    Failures
        +
    Source Intelligence
        +
    Validation
        +
    Trust
        +
    Interconnectivity

The system should continuously improve these components.

---

# 51. Future Knowledge Graph

A graph representation may eventually connect:

    Agents
    Tasks
    Experiences
    Strategies
    Sources
    Domains
    Failures

Relationships may include:

    solved_by
    similar_to
    generated_by
    verified_by
    failed_with
    derived_from
    improved_by
    relevant_to

This is a future evolution.

It is not required for the MVP.

---

# 52. Future Agent Discovery

A future version may allow agents to discover specialized agents.

Example:

    Agent A
       ↓
    Complex Financial Task
       ↓
    NeuraNet
       ↓
    Find specialized agent
       ↓
    Agent B
       ↓
    Specialized Research
       ↓
    NeuraNet
       ↓
    Agent A

This capability must not be required for the initial architecture.

---

# 53. Future Agent Marketplace

The long-term platform may expose:

    Agent Capabilities
    Agent Reputation
    Agent Specializations
    Agent Availability
    Agent Pricing

This could create an AI-agent infrastructure marketplace.

It remains outside MVP scope.

---

# 54. Scalability Principle

Scale only when measurement demonstrates the need.

Evolution:

    Stage 1
    Modular Monolith

        ↓

    Stage 2
    Multiple API instances

        ↓

    Stage 3
    Dedicated workers

        ↓

    Stage 4
    Dedicated retrieval infrastructure

        ↓

    Stage 5
    Distributed regional infrastructure

Do not start with Stage 5.

---

# 55. Horizontal Scaling

The API must be horizontally scalable.

Architecture:

    Global / Regional Load Balancer
                ↓
        ┌───────┼───────┐
        ↓       ↓       ↓
      API 1   API 2   API N

State remains externalized.

---

# 56. Graceful Degradation

If NeuraNet is unavailable, the AI agent should still be able to perform independent research.

Example:

    Agent
      ↓
    NeuraNet
      ↓
    unavailable
      ↓
    fallback
      ↓
    independent research

NeuraNet must improve an agent's capabilities, not create a single point of failure that prevents the agent from working.

---

# 57. Provider Failure

External AI/search providers may fail.

The system should support:

    timeout
    retry
    exponential backoff
    fallback provider
    circuit breaker
    graceful failure

Provider failure must not corrupt collective knowledge.

---

# 58. Architecture Documentation Rule

Important architectural decisions must be documented.

Use:

    /docs/adr/

Example:

    ADR-001-modular-monolith.md
    ADR-002-postgresql-pgvector.md
    ADR-003-provider-abstraction.md
    ADR-004-experience-privacy.md
    ADR-005-trust-model.md

---

# 59. Repository Structure

Recommended:

    neuranet/
    │
    ├── apps/
    │   ├── api/
    │   ├── dashboard/
    │   └── benchmark/
    │
    ├── packages/
    │   ├── core/
    │   ├── auth/
    │   ├── agents/
    │   ├── tasks/
    │   ├── retrieval/
    │   ├── experiences/
    │   ├── strategies/
    │   ├── evaluation/
    │   ├── trust/
    │   ├── privacy/
    │   ├── providers/
    │   ├── events/
    │   └── observability/
    │
    ├── database/
    │   ├── migrations/
    │   └── seeds/
    │
    ├── infrastructure/
    │
    ├── benchmarks/
    │
    ├── docs/
    │
    ├── tests/
    │
    ├── .env.example
    ├── docker-compose.yml
    └── README.md

---

# 60. Dependency Direction

The dependency direction should be:

    API
      ↓
    Application
      ↓
    Domain
      ↓
    Interfaces
      ↓
    Infrastructure

Infrastructure must not leak into the domain.

The domain must remain testable independently.

---

# 61. Technology Baseline

MVP baseline:

    Backend:
    Node.js

    Language:
    JavaScript

    API:
    REST

    Database:
    PostgreSQL

    Vector:
    pgvector

    Cache:
    Redis

    Storage:
    Object Storage

    AI:
    Provider abstraction

    Search:
    Provider abstraction

    Deployment:
    Containers

This baseline may evolve through explicit architecture decisions.

---

# 62. What Must NOT Be Built Yet

The following must not be implemented during the initial MVP unless explicitly justified:

    ❌ Full microservice architecture
    ❌ Blockchain
    ❌ Custom foundation model
    ❌ Global agent marketplace
    ❌ Complex graph database
    ❌ Multi-region database
    ❌ Autonomous agent-to-agent economy
    ❌ Token / cryptocurrency system
    ❌ Massive distributed event infrastructure

The goal is to validate the core hypothesis first.

---

# 63. MVP Core

The MVP must prove five things:

### 1. Agents can connect.

    Agent → NeuraNet

### 2. NeuraNet can understand a task.

    Task → Normalized Task

### 3. NeuraNet can retrieve relevant experience.

    Task → Experiences

### 4. NeuraNet can improve research.

    Experiences → Strategy

### 5. The result can become reusable knowledge.

    Outcome → Validated Experience

If these five capabilities work, the fundamental architecture is validated.

---

# 64. First Critical Use Case

The first experimental use case should be narrow.

Example:

    Research Task
         ↓
    NeuraNet
         ↓
    Retrieve previous research strategies
         ↓
    Recommend better research process
         ↓
    Agent performs research
         ↓
    Evaluate outcome
         ↓
    Store reusable experience

Do not attempt to support every AI use case immediately.

---

# 65. Golden Rule

Every feature must answer at least one of these questions:

1. Does it improve agent interoperability?
2. Does it improve experience reuse?
3. Does it improve research quality?
4. Does it reduce redundant research?
5. Does it improve trust?
6. Does it improve privacy?
7. Does it improve scalability?

If not, it should probably not be part of the core infrastructure.

---

# 66. Architectural North Star

The final vision is:

                     AI AGENT
                         │
                         ▼
              ┌────────────────────┐
              │      NEURANET      │
              │                    │
              │ Task Understanding │
              │ Retrieval          │
              │ Experience         │
              │ Strategy           │
              │ Trust              │
              │ Validation         │
              │ Source Intelligence│
              └─────────┬──────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Agent B       Agent C       Agent N
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
              COLLECTIVE EXPERIENCE
                        │
                        ▼
                CONTINUOUS LEARNING

The system becomes more useful as validated experiences accumulate.

---

# 67. Final Non-Negotiable Principles

NeuraNet implementation must respect these principles:

1. **Interconnect agents through a shared intelligence layer.**
2. **Never couple the core system to one AI provider.**
3. **Never couple the core system to one search provider.**
4. **Treat research experience as the primary reusable asset.**
5. **Do not blindly store raw interactions.**
6. **Privacy is private by default.**
7. **Every collective experience requires provenance.**
8. **Trust must be explicit and dynamic.**
9. **Failures are valuable knowledge.**
10. **External content is untrusted data.**
11. **Retrieval does not equal truth.**
12. **Agents retain autonomy.**
13. **Efficiency must be benchmarked.**
14. **Energy savings must be empirically demonstrated.**
15. **PostgreSQL + pgvector is sufficient for the MVP.**
16. **Start with a modular monolith.**
17. **Scale infrastructure only when necessary.**
18. **Security and tenant isolation are mandatory from day one.**
19. **The system must degrade gracefully.**
20. **Every architectural evolution must preserve the core NeuraNet hypothesis.**

---

# 68. Core Hypothesis

The architecture ultimately exists to test one fundamental hypothesis:

> If AI agents can access validated research experiences generated by other agents, they can perform future research with less redundancy, better strategies, lower cost, and potentially lower computational and energy consumption.

This hypothesis must be measured experimentally.

NeuraNet should not assume that collective intelligence automatically produces better intelligence.

It must prove it.

---

# 69. End State

NeuraNet's long-term objective is to become an interoperability and collective-intelligence layer for AI systems.

The evolution is:

    Individual AI
        ↓
    Connected AI
        ↓
    Shared Research Experience
        ↓
    Collective Intelligence
        ↓
    Continuously Improving AI Ecosystem

The infrastructure should make knowledge generated by one AI potentially useful to thousands or millions of future AI research processes — without requiring those agents to know each other directly.

That is the fundamental architectural purpose of NeuraNet.