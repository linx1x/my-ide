---
name: architecture-patterns
description: Master Clean Architecture, Hexagonal Architecture, and DDD for maintainable, testable systems. Use when planning structure, refactoring monoliths, adding layers, or establishing architecture standards.
---

# Architecture Patterns

Apply proven backend architecture patterns: Clean Architecture, Hexagonal (Ports & Adapters), and Domain-Driven Design.

## When to Use

- Planning microservices decomposition or module boundaries
- Creating testable, mockable codebases
- Implementing domain-driven design principles
- Migrating from tightly coupled to loosely coupled code
- Establishing architecture standards for the team
- Refactoring monolithic or large files (e.g. dashboard server or route modules)
- Designing new backend or service layers

## Core Concepts

### 1. Clean Architecture (Uncle Bob)

**Layers (dependencies point inward):**

- **Frameworks & Drivers:** UI, database, external services
- **Interface Adapters:** Controllers, presenters, gateways
- **Use Cases:** Application business rules
- **Entities:** Core business models

**Principles:** Business logic independent of frameworks; inner layers know nothing about outer layers; testable without UI/DB/externals.

### 2. Hexagonal (Ports and Adapters)

- **Ports:** Interfaces defining interactions (no implementation)
- **Adapters:** Implementations of ports (DB, REST, message queue)
- **Domain Core:** Business logic only; technology-agnostic

**Benefits:** Clear separation; swap implementations (e.g. mock for tests); no framework coupling in core.

### 3. Domain-Driven Design (DDD)

- **Strategic:** Ubiquitous Language, Bounded Contexts, Context Mapping
- **Tactical:** Entities, Value Objects, Aggregates, Repositories, Domain Events

## Directory Structure (Clean / Hexagonal)

```
app/
├── domain/           # Entities & business rules
│   ├── entities/
│   ├── value_objects/
│   └── interfaces/   # Abstract ports
├── use_cases/        # Application business rules
├── adapters/         # Implementations (repositories, controllers, gateways)
└── infrastructure/   # Framework & external concerns
```

## Best Practices

1. **Dependencies point inward** — domain never imports from adapters or infrastructure.
2. **Thin controllers** — route handlers delegate to use cases; no business logic in HTTP layer.
3. **Ports (interfaces)** for any I/O — DB, WhatsApp, HTTP, CLI; adapters implement them.
4. **Rich domain** — behavior with data in entities; avoid anemic models.
5. **Test independence** — core testable without starting Express or DB.

## Common Pitfalls

- Over-engineering simple CRUD with full Clean Architecture
- Business logic in controllers or route handlers
- Concrete dependencies in core (use dependency injection / interfaces)
- Anemic domain (entities with only data, no behavior)

## In This Codebase

- **Bridge:** WhatsApp, dashboard `server`, and route modules are adapters around shared services and safe project operations.
- **Dashboard:** Prefer extracting route handlers into modules that call shared use-case or service functions; keep `server.ts` as composition and middleware only where possible.
- **Config:** Already centralized in `config.ts`; treat as infrastructure.
