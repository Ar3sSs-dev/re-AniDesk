# Svelte 5 Component Audit Handoff Report

## 1. Observation

During the read-only audit of `UserRating.svelte`, `Release.svelte`, and related files, the following syntax and structural patterns were observed:

### A. Mixed Event Handlers in `Release.svelte`
* **File Path**: `src/app/pages/Release.svelte`
* **Observation**: Svelte 5 style element event attributes (without `on:` prefix) are mixed with legacy Svelte 4 event directives (`on:eventName`) in the same template.
* **Exact Lines**:
  * Lines 108–113:
    ```svelte
    108:                 onmouseenter={(e) => {
    109:                     e.currentTarget.classList.remove("hide-scroll");
    110:                 }}
    111:                 onmouseleave={(e) => {
    112:                     e.currentTarget.classList.add("hide-scroll");
    113:                 }}
    ```
  * Legacy directives on child components throughout the file, e.g.:
    * Line 153: `<LeftReleaseBaseButton ... on:showAuthModal={() => (showAuthModal = true)}>`
    * Line 176: `<UserRating release={r.release} on:showAuthModal={() => (showAuthModal = true)} />`
    * Line 281: `on:closeModal={() => (showSelectEpisodeModal = false)}`

### B. State Mutation During Rendering in `Release.svelte`
* **File Path**: `src/app/pages/Release.svelte`
* **Observation**: State-mutating functions are executed directly inside the template evaluation block of the resolved promise.
* **Exact Lines**:
  * Lines 95–96:
    ```svelte
    95:         {setFavoriteCount(r.release.favorites_count)}
    96:         {changeFavorite(r.release.is_favorite)}
    ```
  * Lines 68–74 (state-mutating function definitions in `<script>`):
    ```javascript
    68:     function setFavoriteCount(i) {
    69:         favoriteCount = i;
    70:     }
    71: 
    72:     function changeFavorite(i) {
    73:         isFavorite = i;
    74:     }
    ```

### C. Legacy Event Dispatching in `UserRating.svelte`
* **File Path**: `src/app/components/release/UserRating.svelte`
* **Observation**: The component uses standard Svelte 4/legacy API patterns. It compiles and operates as a legacy compatibility component.
* **Exact Lines**:
  * Line 2: `import { createEventDispatcher } from "svelte";`
  * Line 6: `const dispatch = createEventDispatcher();`
  * Line 13: `dispatch("showAuthModal");`
  * Lines 35–37:
    ```svelte
    35:                 on:mouseenter={() => hoveredRating = star}
    36:                 on:mouseleave={() => hoveredRating = 0}
    37:                 on:click={() => rateTitle(star)}
    ```

### D. New Event Syntax Mixed with Legacy Dispatch in Child Components
* **File Paths**:
  * `src/app/components/buttons/LeftReleaseBaseButton.svelte`
  * `src/app/components/elements/CommentItem.svelte`
* **Observation**: Element event listeners use new Svelte 5 `onclick` syntax, but communicate events to parents using legacy `createEventDispatcher`.
* **Exact Lines**:
  * `LeftReleaseBaseButton.svelte` Line 58: `onclick={btnType !== "bookmark" ? onClickCallback : ...}`
  * `LeftReleaseBaseButton.svelte` Line 96: `dispatch("showAuthModal");`
  * `CommentItem.svelte` Line 72: `onclick={() => updateViewportComponent(9, comment.profile.id)}`
  * `CommentItem.svelte` Line 138: `dispatch("showAuthModal");`

---

## 2. Logic Chain

The step-by-step reasoning explaining the compile-time and runtime failures is as follows:

1. **Compile-time Error: Mixed Event Handlers**
   * **Rule**: Svelte 5 does not allow mixing old-style event directives (`on:click`) and new-style event attributes (`onclick`) in the same component template. Mixing them triggers a compile-time `mixed_event_handlers` error.
   * **Application**: `Release.svelte` uses `onmouseenter`/`onmouseleave` (Svelte 5 syntax) on the `.left-info-release` div (Lines 108/111), but uses `on:showAuthModal`/`on:closeModal` (legacy syntax) on child components. This combination fails compilation during rollup build.

2. **Runtime Error: Rogue State Mutation During Rendering**
   * **Rule**: In Svelte 5, state variables must not be mutated during the rendering/template-evaluation phase (as it causes infinite update cycles). Svelte 5's reactivity engine throws a runtime error (e.g., `state_unsafe_mutation`) if this is detected.
   * **Application**: Evaluating `{setFavoriteCount(r.release.favorites_count)}` and `{changeFavorite(r.release.is_favorite)}` in the markup of `Release.svelte` (Lines 95–96) mutates the reactive state variables `favoriteCount` and `isFavorite` during the render phase. This will cause the page to crash upon loading.

3. **Runtime Error: Broken Communication with Runes-mode Child Components**
   * **Rule**: When a component is compiled in Svelte 5 runes mode (triggered by the presence of new syntax like `onclick` on HTML elements), its `createEventDispatcher` calls map to callback props (e.g. `onshowAuthModal`). Parent components cannot listen to these using legacy `on:showAuthModal` directives.
   * **Application**: Since `LeftReleaseBaseButton.svelte` and `CommentItem.svelte` use `onclick`, Svelte 5 compiles them in runes/Svelte 5 mode. Their dispatched events (`showAuthModal`, `notAvaliable`) are transformed to callback props. Because `Release.svelte` listens using legacy directives (`on:showAuthModal`, `on:notAvaliable`), the connection is broken. Clicks on buttons inside these child components will fail silently to open the login or notification modals.

---

## 3. Caveats

* **Build execution**: Compilation and bundling tests could not be executed directly in the shell because the `npm` and `node` binaries are missing from the environment PATH. Analysis is based entirely on source-code parsing and Svelte 5 specifications.
* **Compatibility choice**: We assume that keeping components in Svelte 4 legacy compatibility mode is preferred. Since the codebase predominantly uses legacy syntax (e.g. `export let`, `on:`, etc.) and does not use runes (`$state`), a full Svelte 5 runes rewrite is unnecessary and high-risk.

---

## 4. Conclusion

The application will fail to compile and render the page due to Svelte 5 syntax conflicts and unsafe rendering state mutations in `Release.svelte`.

### Recommendation Fix Strategy
Revert event attributes in `Release.svelte`, `LeftReleaseBaseButton.svelte`, and `CommentItem.svelte` to legacy Svelte 4 event directives (`on:`) to make them fully compatible legacy components, and relocate the state initialization in `Release.svelte` from the template to the `<script>` block.

### Proposed Code Changes

#### 1. In `src/app/pages/Release.svelte`

* **Step A**: Revert `onmouseenter` and `onmouseleave` to legacy syntax.
  * **Before** (Lines 108–113):
    ```svelte
    onmouseenter={(e) => {
        e.currentTarget.classList.remove("hide-scroll");
    }}
    onmouseleave={(e) => {
        e.currentTarget.classList.add("hide-scroll");
    }}
    ```
  * **After**:
    ```svelte
    on:mouseenter={(e) => {
        e.currentTarget.classList.remove("hide-scroll");
    }}
    on:mouseleave={(e) => {
        e.currentTarget.classList.add("hide-scroll");
    }}
    ```

* **Step B**: Move state initialization from template to the promise resolver in `<script>`, and remove the template setters.
  * **Before** (Lines 31–47):
    ```javascript
    release.then((data) => {
        discordRPC.setActivity({
            ...
        });
    });
    ```
    And Lines 95–96 in markup:
    ```svelte
    {setFavoriteCount(r.release.favorites_count)}
    {changeFavorite(r.release.is_favorite)}
    ```
  * **After** (Update promise resolver):
    ```javascript
    release.then((data) => {
        isFavorite = data.release.is_favorite;
        favoriteCount = data.release.favorites_count;

        discordRPC.setActivity({
            type: 3,
            state: "На странице релиза",
            details: data.release.title_ru.slice(0, 127),
            largeImageKey: "anidesk-transparent",
            largeImageText: "AniDesk - Anixart Client",
            instance: true,
            buttons: [
                {
                    label: "Ссылка на релиз",
                    url: `https://anixart.app/release/${data.release.id}`,
                },
                { label: "Ссылка на клиент", url: "https://anidesk.ds1nc.ru/" },
            ],
        });
    });
    ```
    And completely remove Lines 95–96 from the markup.

#### 2. In `src/app/components/buttons/LeftReleaseBaseButton.svelte`
* Revert element `onclick` attributes to legacy `on:click` to restore event compatibility.
* **Before** (Lines 58–64 and Line 84):
  ```svelte
  58:         onclick={btnType !== "bookmark" ...}
  84:                     onclick={async () => { ... }}
  ```
* **After**:
  ```svelte
  58:         on:click={btnType !== "bookmark" ...}
  84:                     on:click={async () => { ... }}
  ```

#### 3. In `src/app/components/elements/CommentItem.svelte`
* Revert element `onclick` attributes to legacy `on:click` to restore event compatibility.
* **Before**:
  `onclick` on lines 72, 83, 134, 157, 179, 199.
* **After**:
  Change all element `onclick` to `on:click`.

---

## 5. Verification Method

To independently verify this:

1. **Build Verification**:
   * Add Node/npm to PATH or execute rollup bundler directly.
   * Run the build script: `npm run build`.
   * **Pass criteria**: Rollup completes bundling without throwing `mixed_event_handlers` or parsing errors.

2. **Runtime Verification**:
   * Launch the AniDesk client or load the built project in electron.
   * Navigate to any anime release page (e.g. `/release/123`).
   * **Pass criteria**:
     * The Release page renders fully (no blank screens or console exceptions about state mutations during render).
     * Hovering over the poster area shows/hides the scrollbar correctly.
     * Clicking stars in `UserRating` when logged out opens the login modal.
     * Clicking "Favorite", "Bookmark", or comment interaction buttons (likes, replies) when logged out correctly invokes the login or error modal.
