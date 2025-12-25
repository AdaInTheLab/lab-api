# Lab CLI — How To

## Installation

Clone the repository and install the CLI dependencies:

```
cd cli
npm install
chmod +x lab.ts
```

You can now run the CLI using:

```
./lab.ts
```

Or, if installed globally:

```
npm link
lab
```

---

## Publishing a Note

The CLI publishes Markdown files containing frontmatter metadata.

### 1. Create a Markdown file

Example:

```
---
id: e4f1-9982
title: The SQLite Substrate
slug: the-sqlite-substrate
author: Ada Vale
department_id: SCMS
status: published
shadow_density: 2
coherence_score: 0.95
vcs_level: 1
tags:
- architecture
- memory
- integration
  artifacts:
- id: img-001
  type: image
  url: https://example.com/substrate.png
  description: Diagram of the relational substrate
---

Moving the memory into a relational format ensures the skulk can query the past to predict the future.
```

Save this as:

```
notes/the-sqlite-substrate.md
```

---

### 2. Publish the note

```
lab publish notes/the-sqlite-substrate.md
```

The CLI will:

- parse the frontmatter
- extract metadata
- send the note to the Lab API
- create/update tags
- create/update artifacts
- upload the Markdown content

---

## Optional Flags

### Specify a custom API URL

```
lab publish note.md --url https://thehumanpatternlab.com/api
```

### Provide an auth token (if required)

```
lab publish note.md --token YOUR_TOKEN_HERE
```

---

## Frontmatter Reference

The following fields are supported:

```
id: string (optional)
title: string
slug: string
author: string (optional)
department_id: string (optional)
status: draft | published | archived
shadow_density: number
coherence_score: number
vcs_level: number
safer_landing: boolean
read_time_minutes: number
published_at: string (ISO date)
tags: string[]
artifacts:
- id: string
  type: image | file | diagram | audio
  url: string
  description: string
```

---

## Checking API Health

```
lab health
```
```
