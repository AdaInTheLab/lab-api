# 🦊 The Human Pattern Lab CLI - Style Guide

> **Purpose**: This guide captures the conventions, patterns, and gotchas specific to this codebase. Read this before making changes to avoid common pitfalls!

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Import Rules (CRITICAL)](#import-rules-critical)
3. [File Structure & Naming](#file-structure--naming)
4. [Code Conventions](#code-conventions)
5. [Commit Message Format](#commit-message-format)
6. [Testing & Building](#testing--building)
7. [Common Gotchas](#common-gotchas)

---

## Quick Start

### For New Contributors

```bash
# 1. Clone and install
git clone <repo-url>
cd the-human-pattern-lab-cli
npm install

# 2. Build
npm run build

# 3. Test locally
npm start version

# 4. Install globally (optional)
npm install -g .
hpl version

# 5. Run tests
npm test
```

### Key Things to Know Immediately

- ✅ **ES Modules**: This project uses ES Modules (`"type": "module"`)
- ✅ **Import Extensions**: ALL relative imports MUST include `.js` (even for `.ts` files)
- ✅ **Lore-Coded Commits**: Use emoji prefixes (see [Commit Messages](#commit-message-format))
- ✅ **Contract-First**: Output formats are contracts - changes are breaking
- ✅ **JSON Purity**: `--json` mode MUST only emit JSON to stdout

---

## Import Rules (CRITICAL)

### ⚠️ The #1 Source of Errors

**Rule**: ALL relative imports MUST end in `.js`, even though the source files are `.ts`.

### Why?

Node.js ES Modules require explicit file extensions. TypeScript doesn't add them automatically, so you must write them yourself.

### Examples

```typescript
// ❌ WRONG - Will cause ERR_MODULE_NOT_FOUND at runtime
import { something } from "./utils"
import { other } from "../lib/config"
import { helper } from "./helpers/index"

// ✅ CORRECT - Add .js to all relative imports
import { something } from "./utils.js"
import { other } from "../lib/config.js"
import { helper } from "./helpers/index.js"

// ✅ ALSO CORRECT - npm packages don't need extensions
import { Command } from "commander"
import { z } from "zod"
import fs from "node:fs"
```

### Quick Check

Before committing, search for potential missing extensions:

```bash
# Find imports that might be missing .js
grep -r "from ['\"]\.\.*/[^'\"]*[^s]['\"]" src/ --include="*.ts" | grep -v "\.js['\"]"
```

### VS Code Auto-Import Setup

Add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifierEnding": "js",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

This makes VS Code auto-add `.js` when using auto-import!

---

## File Structure & Naming

### Directory Layout

```
src/
├── commands/          # CLI command implementations
│   ├── version.ts
│   ├── capabilities.ts
│   └── notes/        # Domain-specific commands
│       ├── notes.ts  # Domain root (assembler)
│       ├── list.ts
│       ├── get.ts
│       └── create.ts
├── contract/         # Output contracts & schemas
│   ├── envelope.ts   # Success/error wrappers
│   ├── intents.ts    # Intent registry
│   ├── schema.ts     # Zod schemas
│   └── exitCodes.ts
├── lib/              # Shared utilities
├── http/             # HTTP client
├── sdk/              # SDK exports
└── io.ts             # Input/output helpers
```

### Naming Conventions

**Files**: `camelCase.ts` or `kebab-case.ts` (be consistent within a directory)
**Types**: `PascalCase`
**Functions**: `camelCase`
**Constants**: `SCREAMING_SNAKE_CASE` (for true constants) or `camelCase` (for config)
**Enums**: `PascalCase` (enum name) and `SCREAMING_SNAKE_CASE` (values) or `camelCase` (values)

### File Naming Patterns

```typescript
// Command files: <commandName>.ts
src/commands/version.ts
src/commands/health.ts

// Domain folders: <domain>/<domain>.ts is the assembler
src/commands/notes/notes.ts  // Mounts subcommands
src/commands/notes/list.ts   // Individual subcommand

// Contract files: singular nouns
src/contract/envelope.ts
src/contract/schema.ts
```

---

## Code Conventions

### File Headers

All source files should have a lore-coded header:

```typescript
/* ===========================================================
   🌌 HUMAN PATTERN LAB — <DESCRIPTION>
   -----------------------------------------------------------
   Purpose: <What this file does>
   Contract: <Any contractual guarantees, if applicable>
   Notes:
     - <Important implementation detail 1>
     - <Important implementation detail 2>
   =========================================================== */
```

### Function Ordering

Within a file, order from public → private, top → bottom:

```typescript
// 1. Exports first (public API)
export function publicFunction() { ... }
export type PublicType = { ... }

// 2. Internal helpers below
function helperFunction() { ... }

// 3. Constants at top or bottom (be consistent)
const INTERNAL_CONSTANT = "value";
```

### Command Pattern

Commands follow this structure:

```typescript
import { Command } from "commander";
import { writeHuman, writeJson } from "../io.js";
import { EXIT } from "../contract/exitCodes.js";
import { getAlphaIntent } from "../contract/intents.js";
import { ok, err } from "../contract/envelope.js";

type GlobalOpts = { json?: boolean };

export function myCommand(): Command {
  return new Command("mycommand")
    .description("What this command does (contract: intent_name)")
    .action((...args: any[]) => {
      const cmd = args[args.length - 1] as Command;
      const rootOpts = (cmd.parent?.opts?.() ?? {}) as GlobalOpts;
      
      const result = runMyCommand();
      
      if (rootOpts.json) {
        writeJson(result);
      } else {
        writeHuman("Human-friendly output");
      }
      
      process.exitCode = EXIT.OK;
    });
}

// Core logic separated from commander adapter
export function runMyCommand() {
  const intent = getAlphaIntent("my_intent");
  return ok("mycommand", intent, { data: "here" });
}
```

### Error Handling

```typescript
// ✅ GOOD - Return error envelopes
try {
  const data = await fetchData();
  return ok("command", intent, data);
} catch (error: any) {
  return err("command", intent, {
    code: "E_NETWORK",
    message: "Failed to fetch data",
    details: { originalError: error.message }
  });
}

// ❌ BAD - Don't throw unhandled errors
const data = await fetchData(); // Could throw!
```

### Type Safety

```typescript
// ✅ GOOD - Use Zod for runtime validation
const DataSchema = z.object({
  id: z.string(),
  count: z.number()
});

type Data = z.infer<typeof DataSchema>;

// Validate at runtime
const data = DataSchema.parse(unknownData);

// ❌ BAD - Assuming types without validation
const data = unknownData as Data; // No runtime check!
```

---

## Commit Message Format

### Lore-Coded Format (The Human Pattern Lab Style)

This repo uses emoji-prefixed commit messages following the lab's department system:

```
<emoji> <scope>: <subject>

<optional body>

<optional footer>
```

### Common Prefixes

**Engineering & Code (SCMS)**
- `⚙️ feat:` - New features
- `🐛 fix:` - Bug fixes
- `🔧 refactor:` - Code restructuring (no behavior change)
- `⚡ perf:` - Performance improvements
- `🏗️ build:` - Build system changes

**Documentation & Knowledge (KROM)**
- `📚 docs:` - Documentation changes
- `📝 content:` - Content updates
- `🎨 style:` - Code style changes (formatting, no logic change)

**Testing & Quality (QA)**
- `✅ test:` - Adding or updating tests
- `🧪 experiment:` - Experimental features

**Infrastructure & Operations**
- `🚀 deploy:` - Deployment changes
- `🔒 security:` - Security improvements
- `🌉 bridge:` - Relay/bridge system changes (Liminal Bridge)

### Examples

```bash
# Good commit messages
⚙️ feat: Add relay generation command
🐛 fix: Add missing .js extensions to contract imports
📚 docs: Update README with relay examples
🔧 refactor: Extract HTTP client to separate module
✅ test: Add tests for envelope builders

# Include body for complex changes
⚙️ feat: Implement notes sync command

Add bidirectional sync between local markdown files and API.
Supports dry-run mode and conflict resolution.

Closes #42
```

### Commit Message Checklist

- [ ] Starts with appropriate emoji
- [ ] Scope is relevant (feat/fix/docs/etc)
- [ ] Subject line ≤ 50 chars (aim for this)
- [ ] Subject is imperative mood ("Add" not "Added")
- [ ] Body explains WHY, not WHAT (code shows what)
- [ ] Breaking changes noted in footer

---

## Testing & Building

### Build Process

```bash
# Clean build
rm -rf dist/
npm run build

# Watch mode (development)
npm run dev

# Run without building (tsx)
npm run dev version
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# Single test file
npm test -- src/__tests__/config.test.ts
```

### Local Testing Before Publishing

```bash
# 1. Build
npm run build

# 2. Test built version
npm start version

# 3. Install globally from local
npm install -g .

# 4. Test global install
hpl version
hpl version --json

# 5. Check actual output
hpl version --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"
```

---

## Common Gotchas

### 1. Missing .js Extensions

**Symptom**: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module`

**Cause**: Relative import missing `.js` extension

**Fix**: Add `.js` to the import in the SOURCE file (not compiled)

```typescript
// ❌ Before
import { foo } from "./bar"

// ✅ After
import { foo } from "./bar.js"
```

### 2. Type vs Runtime

**Symptom**: Type checks pass but crashes at runtime

**Cause**: TypeScript types don't validate data at runtime

**Fix**: Use Zod schemas for runtime validation

```typescript
// ✅ Do this
const UserSchema = z.object({
  name: z.string(),
  age: z.number()
});

const user = UserSchema.parse(unknownData); // Runtime check!
```

### 3. JSON Purity

**Symptom**: `--json` mode contains non-JSON output

**Cause**: Console logs or errors going to stdout

**Fix**: Use stderr for logs, stdout ONLY for JSON

```typescript
// ❌ BAD
console.log("Fetching data..."); // Goes to stdout!
if (opts.json) writeJson(result);

// ✅ GOOD
if (!opts.json) {
  console.error("Fetching data..."); // stderr only
}
writeJson(result); // stdout
```

### 4. Exit Codes

**Symptom**: Commands succeed but return non-zero exit code

**Cause**: Not setting `process.exitCode` properly

**Fix**: Always set explicit exit codes

```typescript
import { EXIT } from "../contract/exitCodes.js";

// Success
process.exitCode = EXIT.OK;

// Errors
process.exitCode = EXIT.ERROR;
process.exitCode = EXIT.INVALID_INPUT;
```

### 5. Global Install Issues

**Symptom**: Old version runs after `npm install -g .`

**Cause**: npm cache or permission issues

**Fix**: Full reinstall

```bash
# Uninstall
npm uninstall -g @thehumanpatternlab/hpl

# Clear cache
npm cache clean --force

# Reinstall
cd /path/to/the-human-pattern-lab-cli
npm run build
npm install -g .
```

### 6. Windows Path Issues

**Symptom**: Tests fail on Windows but pass on Mac/Linux

**Cause**: Hardcoded `/` separators instead of `path.join()`

**Fix**: Use Node.js path module

```typescript
import path from "node:path";

// ❌ BAD
const filePath = `${dir}/file.txt`;

// ✅ GOOD
const filePath = path.join(dir, "file.txt");
```

---

## Contract Guarantees

### What is a Contract?

The CLI's output format is a **contract** - a stable interface that scripts and agents depend on. Breaking the contract breaks automation.

### Contract Rules

1. **Schema versioning**: All JSON output includes `schemaVersion`
2. **Intent disclosure**: All commands declare their `intent`
3. **Envelope structure**: Success/error formats are stable
4. **Exit codes**: Deterministic exit codes for each scenario
5. **Additive only**: In v0.x, we can ADD but not CHANGE/REMOVE

### What's Breaking?

**Breaking Changes** (require major version bump):
- Changing envelope structure
- Removing fields from JSON output
- Changing exit code meanings
- Renaming commands or flags
- Changing intent IDs

**Non-Breaking Changes** (safe in minor versions):
- Adding new commands
- Adding optional fields to output
- Adding new intents
- Improving error messages
- Internal refactoring

---

## Development Workflow

### Standard Workflow

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Make changes
# ... edit files ...

# 3. Build and test
npm run build
npm test
npm start <command>

# 4. Commit with lore-coded message
git add .
git commit -m "⚙️ feat: Add my feature"

# 5. Push and create PR
git push origin feat/my-feature
```

### Before Committing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Linter happy: `npm run lint` (when added)
- [ ] All imports have `.js` extensions
- [ ] Added tests for new features
- [ ] Updated docs if needed
- [ ] Commit message follows format

---

## Quick Reference Card

**Most Common Commands**:
```bash
npm run build         # Compile TypeScript
npm start <cmd>       # Run built version
npm run dev <cmd>     # Run with tsx (no build)
npm test              # Run tests
npm install -g .      # Install globally from local
```

**Emergency Debugging**:
```bash
# Imports not working?
grep -r "from ['\"]\.\.*/[^'\"]*[^s]['\"]" src/ --include="*.ts" | grep -v "\.js['\"]"

# Clean slate
rm -rf dist/ node_modules/
npm install
npm run build

# Global install issues
npm uninstall -g @thehumanpatternlab/hpl
npm cache clean --force
cd /path/to/repo && npm run build && npm install -g .
```

**Key Files**:
- `src/contract/schema.ts` - Output contract definitions
- `src/contract/intents.ts` - Intent registry
- `src/io.ts` - stdout/stderr helpers
- `bin/hpl.ts` - CLI entrypoint

---

## Getting Help

### Resources

- **README.md**: High-level overview and usage
- **IMPLEMENTATION_NOTES.md**: Architecture decisions
- **docs/**: API documentation and guides

### When in Doubt

1. Look at existing commands for patterns
2. Check contract files for schema examples
3. Run `npm test` to see expected behavior
4. Ask in #engineering channel (if applicable)

---

## Style Guide Itself

### Updating This Guide

This guide should evolve with the codebase. If you:

- **Find a new gotcha**: Add it to [Common Gotchas](#common-gotchas)
- **Establish a pattern**: Document it in [Code Conventions](#code-conventions)
- **Change a rule**: Update relevant sections and note breaking changes

Keep this guide:
- **Practical**: Focus on actionable advice
- **Concise**: Get to the point
- **Current**: Update when patterns change
- **Friendly**: Help future contributors (including future you!)

---

**Last Updated**: 2025-01-27  
**Maintainer**: The Human Pattern Lab / SCMS
**Status**: Living Document 🦊

---

*"The hallway—er, bridge—exists, serves its purpose, and disappears."* 🌉
