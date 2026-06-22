# Contributing to AniDesk

Thank you for contributing to AniDesk! Follow these guidelines to set up your environment and submit contributions.

## Environment Setup

1. **Install Node.js**: Ensure you have Node.js 18+ installed on your system.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run local dev server**:
   To start the Svelte hot reload server and Electron in development mode:
   ```bash
   npm run electron-dev
   ```

---

## Branching & Pull Requests

- Work on a feature branch branch (e.g., `feat/my-feature` or `fix/my-bug`). Do not commit directly to `master` or `main`.
- Open a Pull Request referencing the Issue or detailing the changes.
- Ensure your Svelte build compiles clean (`npm run build`) before opening a PR.

---

## Code Quality & Commit Style

- We use ESLint and Prettier for code consistency. Keep imports clean and avoid unreferenced variables.
- Write descriptive commit messages matching Conventional Commits standards (e.g., `feat: Add playback speed selector`, `fix: Repair licensed release player crash`).
- Avoid mixing styling tweaks with business logic. Keep commits atomic.
