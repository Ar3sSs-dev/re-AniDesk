# Project Architecture

This document provides a high-level overview of the AniDesk codebase structure and details key implementation decisions.

## Process Model

AniDesk is a desktop application powered by Electron and Svelte. It runs in two main processes:

1. **Main Process (`src/main.js`)**:
   - Manages application lifecycles, main windows, menus, and system integration.
   - Hosts the offline download manager (`src/downloader.js`).
   - Implements custom protocol handlers to bypass security controls and load local cached files.
   
2. **Renderer Process (Svelte frontend)**:
   - Built using Svelte. Compiled by Rollup into `public/build/bundle.js`.
   - Communicates with the Main process asynchronously using Electron IPC via `src/preload.js`.

---

## Codebase Map

- [src/main.js](file:///C:/Users/Angel/.gemini/antigravity/brain/a05dc538-153c-4e92-abc2-f743841af6ec/scratch/repo/src/main.js) — Entry point for the Electron Main process.
- [src/preload.js](file:///C:/Users/Angel/.gemini/antigravity/brain/a05dc538-153c-4e92-abc2-f743841af6ec/scratch/repo/src/preload.js) — Exposes IPC events to the Svelte window context securely.
- [src/downloader.js](file:///C:/Users/Angel/.gemini/antigravity/brain/a05dc538-153c-4e92-abc2-f743841af6ec/scratch/repo/src/downloader.js) — Offline downloading manager, file systems streams, and JSON library writer.
- [public/](file:///C:/Users/Angel/.gemini/antigravity/brain/a05dc538-153c-4e92-abc2-f743841af6ec/scratch/repo/public/) — Static assets (assets, HTML template, and Svelte compiled output).
- [src/app/](file:///C:/Users/Angel/.gemini/antigravity/brain/a05dc538-153c-4e92-abc2-f743841af6ec/scratch/repo/src/app/) — Svelte components, pages, state stores, and application logic.

---

## Custom Protocols & Storage

### 1. `anidesk-cache://`
- Used to load locally cached image files (avatars, posters).
- Maps URLs using md5 hash of the original image address to keep file system queries fast.

### 2. `anidesk-offline://`
- Decodes a hex-encoded file path pointing to offline-downloaded episodes on user storage.
- Allows the HTML5 `<video>` element to play local raw streams directly without throwing browser security sandbox exceptions.

### 3. Library Persistence (`library.json`)
- Offline downloads catalog is saved under the user AppData folder in `library.json`.
- Uses an atomic write strategy: writes to `library.json.tmp` first, then renames it to `library.json` to prevent file corruption in case of unexpected application crashes.
