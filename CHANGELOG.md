## [0.1.2]

### FIX [SCMS] Prevent double response in lab-notes route 🧹

- Remove duplicate res.json call in /lab-notes handler
- Ensure handler returns after sending response
- Eliminate "Cannot set headers after they are sent" errors
- Stabilize test output and runtime behavior

## [0.1.1] – 2025-12-29

### Added
- Idempotent database migration for `lab_notes`
- Lightweight schema version tracking via `schema_meta`
- Startup logging for applied schema changes

### Changed
- Centralized DB migration logic into a dedicated module
- Made database bootstrap resilient to existing / older schemas

### Notes
- No API behavior changes
- Safe to deploy over existing databases
