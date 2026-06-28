# Project: AniDesk Deep Audit and Fix

## Architecture
- **Renderer Process**: Svelte 5 UI compiled via Rollup to `public/build/bundle.js` and `public/build/bundle.css`.
- **Main Process**: Electron entry point (`src/main.js`) using `electron-serve` to serve `public` folder and custom `anidesk-cache` / `anidesk-offline` protocols.
- **Environment**: Development mode running unpacked from `app-0.0.1-beta7/resources/app`.

## Code Layout
- `src/main.js`: Main Electron entry script.
- `src/app/components/release/UserRating.svelte`: User rating stars component.
- `src/app/pages/Release.svelte`: Release page containing UserRating.
- `public/`: UI files served by `electron-serve`.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | Initial Codebase Audit | Audit recent modifications to `src/main.js`, `UserRating.svelte`, and `Release.svelte` | None | DONE | cb13422e-d5cb-4279-939a-581ed6fd95d3, 26f93dca-6f9d-4629-9db3-33f1710a35a1, beb909ab-c10b-4529-ad29-731f9d87298b |
| 2 | Implement Fixes | Fix Svelte 5 compilation issues and Electron app launch fallback issues | M1 | DONE | 2853f940-9c48-4999-ad67-aef57ffcd31e |
| 3 | Rebuild & Verify | Compile UI using `npm run build` and run Electron application on host | M2 | IN_PROGRESS | 05c51c71-7478-471b-bf17-fe031dae3b8f, 7f54bed2-8c2b-41c7-8be2-6cac47840725, a9fc9c75-3671-499e-b63b-a21b32644f1e, 9d6982cd-20f6-450f-bba7-62208379ecf5 |
| 4 | Forensic Audit | Verify implementation integrity and ensure clean operation | M3 | PLANNED | TBD |

## Interface Contracts
- **Environment Detection**: `isDev()` function in `main.js` determines whether to load from local dev server `http://localhost:8080` or via `electron-serve` (`anidesk-offline` / local files).
- **Svelte 5 Events**: Event dispatching and listening between Svelte components must adhere to Svelte 5 standards.
