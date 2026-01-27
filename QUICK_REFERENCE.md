# 🦊 HPL CLI - Quick Reference Checklist

> **TL;DR** of the full STYLE_GUIDE.md - print this and keep it handy!

---

## Before You Start 🚀

```bash
□ npm install
□ npm run build
□ npm test
□ Read STYLE_GUIDE.md (at least the Import Rules section!)
```

---

## The #1 Rule ⚠️

**ALL relative imports MUST end in `.js`** (even for `.ts` files)

```typescript
✅ import { foo } from "./bar.js"
❌ import { foo } from "./bar"
```

---

## Before Every Commit ✅

```bash
□ npm run build        # Succeeds?
□ npm test             # Passes?
□ Check .js extensions # All imports have them?
□ Commit message       # Emoji prefix + format?
```

---

## Commit Format 📝

```
<emoji> <scope>: <subject>
```

Common prefixes:
- `⚙️ feat:` - New features
- `🐛 fix:` - Bug fixes  
- `📚 docs:` - Documentation
- `🔧 refactor:` - Code restructuring
- `✅ test:` - Tests
- `🌉 bridge:` - Relay system

---

## Quick Commands 💻

```bash
# Development
npm run dev <command>     # Run with tsx (no build)
npm run build             # Compile TypeScript
npm start <command>       # Run built version

# Testing
npm test                  # All tests
npm test:watch            # Watch mode

# Local Install
npm install -g .          # Install globally
hpl version               # Test it works

# Emergency Reset
rm -rf dist/ node_modules/
npm install && npm run build
```

---

## Debugging Imports 🔍

```bash
# Find imports missing .js
grep -r "from ['\"]\.\.*/[^'\"]*[^s]['\"]" src/ --include="*.ts" | grep -v "\.js['\"]"

# Or just look at the error:
# "Cannot find module '.../XXX' imported from YYY.js"
#                       ^^^           ^^^
#                    Missing .js    Check this source file
```

---

## Command Structure Pattern 📋

```typescript
import { Command } from "commander";
import { writeHuman, writeJson } from "../io.js";
import { EXIT } from "../contract/exitCodes.js";
import { getAlphaIntent } from "../contract/intents.js";
import { ok } from "../contract/envelope.js";

type GlobalOpts = { json?: boolean };

export function myCommand(): Command {
  return new Command("mycommand")
    .description("...")
    .action((...args: any[]) => {
      const cmd = args[args.length - 1] as Command;
      const opts = (cmd.parent?.opts?.() ?? {}) as GlobalOpts;
      
      const result = runMyCommand();
      
      if (opts.json) writeJson(result);
      else writeHuman("...");
      
      process.exitCode = EXIT.OK;
    });
}

export function runMyCommand() {
  const intent = getAlphaIntent("my_intent");
  return ok("mycommand", intent, { /* data */ });
}
```

---

## Common Gotchas 🐛

| Problem | Cause | Fix |
|---------|-------|-----|
| `ERR_MODULE_NOT_FOUND` | Missing `.js` | Add `.js` to import |
| Type passes, runtime fails | No validation | Use Zod schemas |
| JSON has extra output | Logs to stdout | Use `console.error()` |
| Wrong exit code | Not set | Set `process.exitCode` |
| Old version runs | npm cache | `npm uninstall -g && npm cache clean --force` |

---

## Contract Rules 📜

**Breaking Changes** (DON'T DO in v0.x):
- ❌ Change envelope structure
- ❌ Remove JSON fields
- ❌ Change exit codes
- ❌ Rename commands
- ❌ Change intent IDs

**Safe Changes**:
- ✅ Add new commands
- ✅ Add new JSON fields
- ✅ Add new intents
- ✅ Improve error messages
- ✅ Internal refactoring

---

## VS Code Setup 🛠️

Add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifierEnding": "js",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

This auto-adds `.js` to imports!

---

## Files to Know 📁

```
src/
├── contract/          # Output contracts - STABLE
│   ├── schema.ts     # Zod schemas
│   ├── envelope.ts   # Success/error wrappers
│   ├── intents.ts    # Intent registry
│   └── exitCodes.ts  # Exit code constants
├── commands/          # CLI commands
│   └── notes/        # Domain commands
├── lib/              # Shared utilities
└── io.ts             # stdout/stderr helpers

bin/
└── hpl.ts            # Entrypoint
```

---

## Need More Info? 📖

See **STYLE_GUIDE.md** for:
- Detailed explanations
- More code examples
- Architecture decisions
- Full gotcha list
- Contract details

---

## Emergency Contact 🆘

**Totally Stuck?**

1. Check error message carefully (it tells you which file!)
2. Look at similar existing code
3. Run `npm test` to see examples
4. Full reset: `rm -rf dist/ node_modules/ && npm install && npm run build`
5. Ask for help (with error message + what you tried)

---

## Status Checks ✓

**Healthy Repo**:
```bash
$ npm run build
✓ Compiled successfully

$ npm test  
✓ All tests passing

$ npm start version
✓ Shows version

$ hpl version
✓ Shows version (global install works)
```

---

**Print this page and tape it to your monitor!** 🦊

---

*Quick ref for STYLE_GUIDE.md - Last updated: 2025-01-27*
