# BRIEFING — 2026-06-18T00:16:00+03:00

## Mission
Analyze main process code for startup logic, dev vs. prod behavior, protocol registration, loadURL error handling, and launch failures.

## 🔒 My Identity
- Archetype: explorer
- Roles: Main Process Auditor, Explorer 1
- Working directory: C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\.agents\teamwork_preview_explorer_audit_1
- Original parent: 9d4eab06-3aeb-44c5-aa8e-6e8733c89f59
- Milestone: Audit Electron Main Process

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Network mode: CODE_ONLY, no external internet accesses

## Current Parent
- Conversation ID: 9d4eab06-3aeb-44c5-aa8e-6e8733c89f59
- Updated: 2026-06-18T00:16:00+03:00

## Investigation State
- **Explored paths**:
  - `src/main.js` (main process entry point)
  - `src/downloader.js` (downloader utility and path fixes)
  - `package.json` (dependencies and launch scripts)
  - `forge.config.js` (packaging and Electron fuses config)
  - `node_modules/electron-serve/index.js` (local files protocol handler)
- **Key findings**:
  - Electron Fuse `OnlyLoadAppFromAsar: true` prevents loading the unpacked `resources/app` folder when `app.asar` is renamed/absent.
  - Double call to `protocol.registerSchemesAsPrivileged` throws `Error: registerSchemesAsPrivileged can only be called once` due to `electron-serve` queuing it in a microtask while `main.js` calls it synchronously.
  - When `isDev()` is true and localhost:8080 is down, the catch block tries to load local files but fails because of unregistered `app` scheme and uncaught promise rejection from `loadURL(mainWindow)`.
- **Unexplored areas**: None. Audit is complete.

## Key Decisions Made
- Confirmed that we should not perform a code fix directly but provide a patch/proposed solution in the handoff.

## Artifact Index
- C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\.agents\teamwork_preview_explorer_audit_1\ORIGINAL_REQUEST.md — Original request description
- C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\.agents\teamwork_preview_explorer_audit_1\progress.md — Liveness progress update
- C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\.agents\teamwork_preview_explorer_audit_1\handoff.md — Final handoff report
