# Main Process Audit Report (Explorer 1)

## Executive Summary
This audit investigates the Electron main process startup failures, development vs. production detection logic, custom protocol registrations, and URL loading issues in the AniDesk desktop client. 

Our investigation revealed three major problems that cause the application to silently fail to launch, load a blank page, or throw network errors (`ERR_CONNECTION_REFUSED`):
1. **Electron Fuse Lockout**: The binary is configured with the `OnlyLoadAppFromAsar` fuse set to `true`, which forces it to exit immediately if the code is unpacked (e.g. running from `resources/app` folder) and `app.asar` is absent or renamed.
2. **Double Protocol Registration Crash**: A race condition occurs between the `electron-serve` library and `src/main.js` which calls `protocol.registerSchemesAsPrivileged` twice. This throws an uncaught error in a microtask, crashing the main process on startup.
3. **Fragile Fallback Logic**: When running unpacked, `app.isPackaged` evaluates to `false`, causing the app to assume development mode and load `http://localhost:8080/`. If the local server is down, the fallback is unable to run due to the failed protocol registration and an unhandled promise rejection.

---

## 1. Observation
Here is the concrete evidence collected from the audit:

### Observation 1: Electron Fuse Restriction
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\forge.config.js` at lines 53-61:
```javascript
53:     new FusesPlugin({
54:       version: FuseVersion.V1,
55:       [FuseV1Options.RunAsNode]: false,
56:       [FuseV1Options.EnableCookieEncryption]: true,
57:       [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
58:       [FuseV1Options.EnableNodeCliInspectArguments]: false,
59:       [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
60:       [FuseV1Options.OnlyLoadAppFromAsar]: true,
61:     }),
```

### Observation 2: Unpacked Resources Folder
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources`, the contents are:
- `app/` (directory containing unpacked source code)
- `app.asar.bak` (renamed from `app.asar` to back up the packaged archive)
*Note: The required file `app.asar` is completely missing from this folder.*

### Observation 3: Electron-Serve Library Initialization
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\src\main.js` at lines 5-6:
```javascript
5: const serve = require('electron-serve').default;
6: const loadURL = serve({ directory: './public' });
```

### Observation 4: Asynchronous Microtask Scheme Registration
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\node_modules\electron-serve\index.js` at lines 10-23:
```javascript
const registerScheme = scheme => {
	if (schemesRegistered) {
		throw new Error('electron-serve: A new scheme cannot be registered after app is ready. Make sure to call serve() before app.whenReady().');
	}

	pendingSchemes.push(scheme);

	if (pendingSchemes.length === 1) {
		queueMicrotask(() => {
			schemesRegistered = true;
			electron.protocol.registerSchemesAsPrivileged(pendingSchemes);
		});
	}
};
```
*Note: This queues scheme registration in the microtask queue during module evaluation.*

### Observation 5: Synchronous Scheme Registration
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\src\main.js` at lines 17-20:
```javascript
17: protocol.registerSchemesAsPrivileged([
18:   { scheme: 'anidesk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } },
19:   { scheme: 'anidesk-offline', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
20: ]);
```

### Observation 6: Environment Detection & Load Fallbacks
In `C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\resources\app\src\main.js` at lines 134-136 and 168-175:
```javascript
134: function isDev() {
135:   return !app.isPackaged;
136: }
...
168:   if (isDev()) {
169:     mainWindow.loadURL('http://localhost:8080/').catch((err) => {
170:       console.warn("Dev server not running, falling back to local files:", err.message);
171:       loadURL(mainWindow);
172:     });
173:   } else {
174:     loadURL(mainWindow);
175:   }
```

---

## 2. Logic Chain
Step-by-step reasoning explaining why the launch fails:

1. **Step 1 (Why the application binary immediately exits when unpacked)**:
   - According to **Observation 1**, the fuse `OnlyLoadAppFromAsar` is set to `true`. This locks the executable to only load code from `resources/app.asar`.
   - According to **Observation 2**, the `resources/app.asar` has been renamed to `app.asar.bak` and replaced with an unpacked `resources/app` folder.
   - When launching `AniDesk.exe`, the Electron bootstrapper checks the `OnlyLoadAppFromAsar` fuse. Seeing it is `true`, it checks for `resources/app.asar`. Since it is missing, Electron refuses to fall back to the unpacked `app` folder and exits silently during initial startup.

2. **Step 2 (Why the main process crashes when run unpacked or in dev)**:
   - When the main process starts, `src/main.js` is imported.
   - At line 6 (**Observation 3**), `serve()` is executed. In `electron-serve`, this queues a microtask (**Observation 4**) to call `protocol.registerSchemesAsPrivileged([ { scheme: 'app', ... } ])`.
   - The execution continues synchronously. At lines 17-20 (**Observation 5**), `protocol.registerSchemesAsPrivileged` is called synchronously for the custom `anidesk-cache` and `anidesk-offline` schemes.
   - Once the synchronous parsing finishes, the microtask queue is flushed. The microtask scheduled by `electron-serve` executes and calls `protocol.registerSchemesAsPrivileged` for the second time.
   - Electron allows `registerSchemesAsPrivileged` to be called **only once**. The second call throws an uncaught `Error: registerSchemesAsPrivileged can only be called once`.
   - This uncaught exception crashes the application immediately before the window is created, resulting in a silent failure to launch.

3. **Step 3 (Why it loads the wrong URL / ERR_CONNECTION_REFUSED)**:
   - Even if the process did not crash (or if it runs in an environment where the microtask exception is caught/logged without crashing):
   - When unpacked, `app.isPackaged` evaluates to `false` (**Observation 6**), causing `isDev()` to return `true`.
   - The app attempts to load the development URL: `http://localhost:8080/`.
   - If the dev server is not running, the load fails with `ERR_CONNECTION_REFUSED`.
   - The `.catch()` block attempts to fall back to `loadURL(mainWindow)` (which requests `app://-/`).
   - However, because the `app` scheme registration failed, the scheme is not registered as privileged (standard/secure). As a result:
     - The browser cannot resolve relative assets (e.g. `bundle.js`), CORS errors are thrown, and standard Web APIs are blocked.
     - Additionally, the call to `loadURL(mainWindow)` inside the catch block is asynchronous and lacks its own `.catch()` handler, throwing an unhandled promise rejection.
     - The window (created with `show: false`) never receives a successful render/load, so the `ready-to-show` event never fires and the window is never shown.

---

## 3. Caveats
- **Environment Context**: We assumed that the user ran `AniDesk.exe` directly, which relies on the Electron Fuses. If the app is launched via another runner (e.g., raw `electron` binary), the Fuse error won't apply, but the microtask registration crash and environment detection failure will still happen.
- **Node Environment**: Because the fuse `RunAsNode` was set to `false`, we could not run debug scripts directly with `AniDesk.exe` as a Node interpreter, which we verified when standard Node.js redirection failed.

---

## 4. Conclusion & Recommended Fix Strategy
The silent failures are caused by:
1. **Fuse validation** (`OnlyLoadAppFromAsar: true`) restricting execution to ASAR-only files when the actual files are unpacked.
2. **Double calls** to `protocol.registerSchemesAsPrivileged` crashing the main process on startup.
3. **Improper dev environment detection** and unhandled rejections during network fallbacks.

### Recommended Fix Strategy

#### A. Fix the Protocol Registration Crash (Replace `electron-serve`)
The cleanest, most robust fix is to remove the `electron-serve` dependency entirely and write a custom handler in `src/main.js`. This registers all protocols in a single call, preventing the startup crash.

**Proposed Code Changes in `src/main.js`**:

*Remove lines 5-6*:
```javascript
// Remove:
// const serve = require('electron-serve').default;
// const loadURL = serve({ directory: './public' });
```

*Update lines 17-20 to include `app` scheme*:
```javascript
// Before:
protocol.registerSchemesAsPrivileged([
  { scheme: 'anidesk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } },
  { scheme: 'anidesk-offline', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

// After:
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
  { scheme: 'anidesk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } },
  { scheme: 'anidesk-offline', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);
```

*Add custom protocol handler inside `app.on('ready')`*:
```javascript
app.on('ready', () => {
  // Custom local files server protocol handler (Replacing electron-serve)
  protocol.handle('app', async (req) => {
    try {
      const url = new URL(req.url);
      let filePath = path.join(app.getAppPath(), 'public', decodeURIComponent(url.pathname));

      // Prevent Directory Traversal
      const relative = path.relative(path.join(app.getAppPath(), 'public'), filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response(null, { status: 404, statusText: 'Not Found' });
      }

      // Default to index.html for Single Page App routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(app.getAppPath(), 'public', 'index.html');
      }

      const buffer = await fs.promises.readFile(filePath);
      let contentType = 'text/html';
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json' || ext === '.map') contentType = 'application/json';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      return new Response(buffer, {
        headers: { 'Content-Type': contentType }
      });
    } catch (err) {
      console.error("Custom app protocol handler error:", err);
      return new Response(null, { status: 500 });
    }
  });

  // (Remainder of app ready logic)
  const cacheInFlight = new Map();
  ...
```

*Replace calls to `loadURL(mainWindow)` in `createWindow()`*:
```javascript
// Before:
  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/').catch((err) => {
      console.warn("Dev server not running, falling back to local files:", err.message);
      loadURL(mainWindow);
    });
  } else {
    loadURL(mainWindow);
  }

// After:
  const loadLocalFiles = () => {
    mainWindow.loadURL('app://-/index.html').catch((err) => {
      console.error("Failed to load local files:", err);
    });
  };

  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/').catch((err) => {
      console.warn("Dev server not running, falling back to local files:", err.message);
      loadLocalFiles();
    });
  } else {
    loadLocalFiles();
  }
```

#### B. Fix the Unpacked Execution Failures
To allow testing the app unpacked:
1. **ASAR packaging requirement**: Ensure the app resources are packaged into `app.asar` (rename `app.asar.bak` to `app.asar` and remove the unpacked `app/` directory).
2. **Disable the Fuse for development/unpacked builds**: In `forge.config.js`, change `[FuseV1Options.OnlyLoadAppFromAsar]: false` if distributing unpacked files, or make it conditional.

---

## 5. Verification Method
To verify the findings and fixes:
1. **Check process crash**: Run the application from powershell (`& "C:\Users\Angel\AppData\Local\AniDesk\app-0.0.1-beta7\AniDesk.exe"`). Look in `Squirrel-UpdateSelf.log` or the system event viewer. If it crashes instantly with a silent exit code, it validates both the Fuse validation lockout and the double-registration microtask exception.
2. **Rename ASAR validation**: Rename `app.asar.bak` to `app.asar` and run the executable. If it starts, it validates the `OnlyLoadAppFromAsar` fuse block.
3. **Code inspection**: Open `src/main.js` and verify that the proposed single `protocol.registerSchemesAsPrivileged` call and custom `protocol.handle('app', ...)` replace `electron-serve` to ensure no uncaught microtask errors occur during initialization.
