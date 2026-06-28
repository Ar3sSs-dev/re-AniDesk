# Analysis Report: AniDesk Electron Application Launch Failure

## Executive Summary
This report analyzes the AniDesk Electron application launch failure when running from the unpacked directory (`resources/app`). When launched unpacked, the application displays a blank screen because the UI fails to load, throwing `ERR_CONNECTION_REFUSED` on `localhost:8080`. This is caused by the environment detection logic in `src/main.js` which defaults to loading the UI from a local development server on port 8080 whenever the application is not running from a packaged ASAR archive.

---

## 1. Root Cause Analysis

### 1.1 Code Inspection of `src/main.js`
In `src/main.js`, the environment detection is defined as follows:

```javascript
// Lines 134-136
function isDev() {
  return !app.isPackaged;
}
```

In the `createWindow` function, the application decides how to load the UI:

```javascript
// Lines 168-172
  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/');
  } else {
    loadURL(mainWindow);
  }
```

### 1.2 The Failure Mechanism
1. **Unpackaged Execution**: When the Electron application is launched using the unpacked `resources/app` folder, Electron sets `app.isPackaged` to `false`.
2. **Development Path**: Because `app.isPackaged` is `false`, the helper `isDev()` returns `true`.
3. **Port 8080 Request**: The app attempts to load `http://localhost:8080/` via `mainWindow.loadURL()`.
4. **Connection Refusal**: In standard launch mode, there is no development server (such as Rollup/Vite dev server) running on port 8080. Therefore, the connection is refused, resulting in a blank screen and `ERR_CONNECTION_REFUSED` in the webContents log.
5. **No Local Fallback**: The code lacks error-handling or fallback logic to load compiled files from the `./public` directory when the local server is unavailable.

---

## 2. Proposed Options

### Option A: Fix Launch Logic in `main.js`
Modify `src/main.js` to automatically fall back to the locally compiled files in the `public` directory if the dev server is unreachable or if a specific mode is selected.

#### Proposed Change (using Promise Catch Fallback)
Since `mainWindow.loadURL()` returns a Promise, we can catch the connection failure and load the local files:

```javascript
// Before (Lines 168-172):
  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/');
  } else {
    loadURL(mainWindow);
  }

// After:
  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/').catch((err) => {
      console.warn("Dev server not running, falling back to local files:", err.message);
      loadURL(mainWindow);
    });
  } else {
    loadURL(mainWindow);
  }
```

#### Proposed Change (using Command Line Flag)
Alternatively, we can refine the definition of `isDev()` to require a specific environment variable or flag, meaning that by default the unpacked application runs in "production/local file" mode:

```javascript
// Before (Lines 134-136):
function isDev() {
  return !app.isPackaged;
}

// After:
function isDev() {
  return !app.isPackaged && process.env.ELECTRON_DEV === 'true';
}
```
If this approach is used, running the app without `ELECTRON_DEV=true` will bypass the `localhost:8080` check entirely and load local files.

---

### Option B: Restoring or Repacking the ASAR Archive

If you prefer to run the application in its intended packaged state, you can restore `app.asar`.

#### Sub-Option B.1: Restore from Backup (`app.asar.bak`)
If no custom modifications have been made to the `resources/app` folder, we can simply restore the backup file:
1. Rename `resources/app` to `resources/app.unpacked` (or delete/move it).
2. Rename `resources/app.asar.bak` to `resources/app.asar`.
3. Run `AniDesk.exe`. The Electron runtime will automatically detect the ASAR archive and set `app.isPackaged` to `true`, loading the local UI files successfully.

#### Sub-Option B.2: Repack the `resources/app` Directory
If custom modifications were made to the `resources/app` directory and must be preserved:
1. Ensure the `asar` utility is installed (run `npm install -g asar` or use `npx asar`).
2. Run the command to pack the directory:
   ```powershell
   npx asar pack C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app.asar
   ```
3. Move, rename, or delete the unpacked `resources/app` directory.
4. Run `AniDesk.exe` to verify the application loads correctly from the newly packaged `app.asar`.

---

## 3. Comparison and Recommendation

| Criteria | Option A (Fix main.js) | Option B (Repack / Restore ASAR) |
|---|---|---|
| **Ease of Implementation** | High (few lines of code) | High (rename files or run one command) |
| **Developer Experience** | Excellent (allows live editing/debugging in unpacked folder) | Poor (requires unpacking/repacking for every UI edit) |
| **Execution Integrity** | Good (runs unpacked, but handles errors) | Best (runs exactly as packaged production app) |
| **Impact on App behavior** | Minimal | None (standard behavior) |

### Recommendation
- **For Development & Troubleshooting**: **Option A** is the best choice because it allows files to remain unpacked and editable, while providing a graceful fallback. The Promise-catch method is highly recommended as it requires zero environment variables or configuration updates.
- **For Production Deployment**: **Option B.1 (Restoring the original `app.asar.bak`)** is the best choice because it returns the application to its standard packaged state, ensuring security, performance, and correct auto-updater execution.
