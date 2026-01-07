# 🗃️ Content Source of Truth

This document describes how content is versioned, imported, and treated as canonical within **The Human Pattern Lab**.

## Why the API Owns Content

`lab-api` is the authority for truth because it owns:
- the database (state + history)
- schemas and validation rules
- ingestion and indexing logic
- authentication and write permissions

Because of this, content files are treated as **inputs to a system**, not presentation artifacts.

---

## What Promotion Means

- **Promotion is an explicit act of acceptance.**  
  Content does not become canon by existing or being merged; it becomes canon only when `lab-api` advances its content pointer.

- **Promotion is intentional, not automatic.**  
  Each promotion reflects a conscious decision that a specific content commit is acceptable as truth.

- **Promotion is reproducible and auditable.**  
  The exact content commit promoted to canon is recorded, allowing the system to be rebuilt or inspected at any point in time.

- **Promotion separates creation from authority.**  
  Content may be drafted, revised, or experimented with freely, but authority over truth lives with the API.

- **Promotion is a gate, not a convenience.**  
  Speed is secondary to clarity; friction is allowed when it preserves meaning and system integrity.


---
## Git Submodule Design

The Lab’s content repository is mounted into `lab-api` as a **git submodule**:

- `./content/`

This allows:
- deterministic imports
- reproducible rebuilds
- historical inspection (“what did the Lab know then?”)
- separation between *meaning* and *rendering*

The main site consumes API outputs only.  
It does not interpret, validate, or author truth.

---

*(continue with the full workflow + pitfalls section you already have below this)*
