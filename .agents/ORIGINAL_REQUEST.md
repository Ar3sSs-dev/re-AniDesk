# Original User Request

## Initial Request — 2026-06-17T20:52:17Z

# Teamwork Project Prompt — Draft

> Status: Launched.
> Goal: Fix AniDesk launch failure.

The AniDesk Electron application fails to load the UI and shows a blank/silent screen when launched. This happened after unpacking `app.asar` into an `app` folder, modifying some UI components, and rebuilding the Svelte code. 

Working directory: `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app`
Integrity mode: development

## Requirements

### R1. Identify Launch Failure
The team must comb through the `main.js` and app startup logic to identify why the app silently fails to launch or loads the wrong URL when unpacked into the `app` folder (e.g., checking `isDev` logic or `app.isPackaged`).

### R2. Fix Launch Logic or Repack
Fix the application so that it correctly loads the compiled UI from the `public` directory. This can be done either by fixing `main.js` to correctly identify the environment or by packing the `app` folder back into `app.asar` (and removing `app.asar.bak` to prevent conflicts).

## Acceptance Criteria

### Verification
- [ ] Running `$env:PATH = "C:\Users\Angel\node\node-v20.9.0-win-x64;" + $env:PATH; C:\Users\Angel\node\node-v20.9.0-win-x64\node.exe C:\Users\Angel\node\node-v20.9.0-win-x64\node_modules\npm\bin\npx-cli.js electron .` from the `app` directory correctly loads the UI instead of throwing `ERR_CONNECTION_REFUSED` for `localhost:8080`, OR packing to `app.asar` allows the app to start correctly.
- [ ] The app successfully displays the main AniDesk interface without a blank screen.

## Follow-up — 2026-06-17T21:02:22Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Deep Audit and Fix of AniDesk Codebase

The user reports that the AniDesk app still fails to launch correctly after the previous hotfixes. The agent team needs to perform a deep, exhaustive audit of all recent codebase changes, identify the root cause of the silent failure/blank screen, create a plan to fix them, and apply the fixes.

Working directory: `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app`
Integrity mode: development

## Requirements

### R1. Exhaustive Code Audit
Comb through all recent modifications made to the codebase, paying special attention to:
- `src/app/components/release/UserRating.svelte` (recently created)
- `src/app/pages/Release.svelte` (recently modified to include UserRating)
- `src/main.js` (recently modified to change `loadURL` logic)
Identify any logical, syntax, or runtime errors that prevent the app from launching or rendering the UI correctly. 

### R2. Fix and Implement
Create a clear plan detailing the errors found. Then, implement the fixes across the Svelte components and Electron main process to ensure the application starts flawlessly. Do not spare effort; if the recent `main.js` change needs a complete rewrite to correctly load `app.isPackaged` state or `electron-serve`, do it. 

### R3. Rebuild and Test
Rebuild the application using `npm run build` or `npx rollup -c --bundleConfigAsCjs`.
Test the application by running it to ensure it successfully launches and displays the UI without silent failures.

## Acceptance Criteria

### Audit & Fix Verification
- [ ] A concrete list of errors found in the recent changes is documented in `PROJECT.md` or a similar tracking file.
- [ ] All identified errors are fixed in the code.
- [ ] Running `$env:PATH = "C:\Users\Angel\node\node-v20.9.0-win-x64;" + $env:PATH; C:\Users\Angel\node\node-v20.9.0-win-x64\node.exe C:\Users\Angel\node\node-v20.9.0-win-x64\node_modules\npm\bin\npx-cli.js electron .` successfully launches the app and does not exit with code 1 or throw `ERR_CONNECTION_REFUSED`.
- [ ] The app renders the actual user interface.
