# Synthesized Audit Findings and Fix Plan

This document synthesizes findings from 3 Explorer audits (Main Process, Renderer Components, and Build Configuration). These issues prevent the AniDesk application from launching, compiling, or rendering correctly.

---

## 1. Electron Main Process (`src/main.js`)

### Issue 1: Double Protocol Registration Crash
- **Cause**: `electron-serve` asynchronously registers the `app` scheme via a microtask, while `src/main.js` registers `anidesk-cache` and `anidesk-offline` schemes synchronously. Since Electron only allows `protocol.registerSchemesAsPrivileged` to be called once, the second call throws an uncaught error in a microtask, causing the main process to crash immediately on startup.
- **Fix**: Remove `electron-serve` entirely. Register all schemes (`app`, `anidesk-cache`, and `anidesk-offline`) in a single synchronous call at the top of `src/main.js`. Add a custom protocol handler inside `app.on('ready')` using `protocol.handle('app', ...)` to serve assets from the `./public` directory.

### Issue 2: Dev Environment Fallback Failure
- **Cause**: When running unpacked, `app.isPackaged` evaluates to `false`, causing `isDev()` to return `true`. The application attempts to load `http://localhost:8080/`. If the dev server is not running, it catches the error and tries to load local files via `electron-serve` (which failed to register). This throws an unhandled promise rejection and fails to show the window.
- **Fix**: Rewrite environment loading logic to cleanly fall back to `app://-/index.html` and properly catch/log failures.

---

## 2. Renderer Process (Svelte 5 Components)

### Issue 3: Mixed Svelte Event syntax in `Release.svelte`
- **Cause**: Mixing Svelte 5 HTML element event attributes (`onmouseenter`, `onmouseleave`) with legacy Svelte 4 component event listeners (`on:showAuthModal`) in `Release.svelte` triggers a compile-time error.
- **Fix**: Change `onmouseenter` and `onmouseleave` on the left-info-release div in `src/app/pages/Release.svelte` to legacy Svelte 4 syntax: `on:mouseenter` and `on:mouseleave`.

### Issue 4: Unsafe State Mutation during Render in `Release.svelte`
- **Cause**: Mutating state inside Svelte 5 markup using `{setFavoriteCount(...)}` and `{changeFavorite(...)}` triggers a runtime infinite loop protection crash (`state_unsafe_mutation`).
- **Fix**: Remove `{setFavoriteCount(r.release.favorites_count)}` and `{changeFavorite(r.release.is_favorite)}` from the template. Instead, initialize the reactive `favoriteCount` and `isFavorite` variables in the `release.then(...)` script block when the promise resolves.

### Issue 5: Broken Event Communication in Child Components
- **Cause**: `LeftReleaseBaseButton.svelte` and `CommentItem.svelte` use Svelte 5 element event handlers (`onclick`), compiling them in runes mode. In runes mode, `createEventDispatcher` maps to callback props (`onshowAuthModal`). However, their parent `Release.svelte` listens to them using legacy syntax (`on:showAuthModal`), which fails to intercept these callback props.
- **Fix**: Revert `onclick` attribute to `on:click` in `LeftReleaseBaseButton.svelte` and `CommentItem.svelte` to ensure they compile as legacy components and propagate events correctly.

---

## 3. Build & Bundling Configuration

### Issue 6: Unexported config in `svelte.config.js`
- **Cause**: `svelte.config.js` defines a configuration object but fails to export it.
- **Fix**: Add `export default config;` at the end of the file.

### Issue 7: Ignored `svelte.config.js` in Rollup config
- **Cause**: `rollup.config.js` does not import or apply `svelte.config.js`.
- **Fix**: Import `svelte.config.js` into `rollup.config.js` and spread `svelteConfig.compilerOptions` inside the `svelte` plugin options.

### Issue 8: Incorrect Warning Filter and Invalid Output Options
- **Cause**: `rollup.config.js` filters warnings using `warning.code.startsWith("a11y-")`. Svelte 5 warnings use underscores (e.g. `a11y_`). There is also an invalid output option `stringArray: false` that causes Rollup warnings.
- **Fix**: Filter both `a11y-` and `a11y_` prefixes. Remove `stringArray: false` from Rollup output config.

### Issue 9: Deprecated Svelte Rollup Plugin and TypeScript Settings
- **Cause**: `package.json` specifies `"rollup-plugin-svelte": "^7.2.3"`, which is deprecated for Svelte 5. `tsconfig.json` uses `"moduleResolution": "node"`, which is deprecated.
- **Fix**: Update `"rollup-plugin-svelte"` to `^8.2.0` in `package.json`. Update `"moduleResolution"` to `"bundler"` in `tsconfig.json`. Run `npm install` after modifying `package.json`.
