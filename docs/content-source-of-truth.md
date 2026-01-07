# 🗃️ Content Source of Truth

This document describes how content is versioned, imported, and treated as canonical within **The Human Pattern Lab**.

## Why the API Owns Content

`lab-api` is the authority for truth because it owns:
- the database (state + history)
- schemas and validation rules
- ingestion and indexing logic
- authentication and write permissions

Because of this, content files are treated as **inputs to a system**, not presentation artifacts.

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
