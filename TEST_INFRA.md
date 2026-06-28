# E2E Test Infra: AniDesk UI Launch Verification

## Test Philosophy
- Opaque-box, requirement-driven. We verify that the Electron app launches and displays the UI successfully, without blank screens or ERR_CONNECTION_REFUSED errors.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | UI Loads Correctly | ORIGINAL_REQUEST §R1, R2 | 5 | 5 | ✓ |
| 2 | Dev/Prod Fallback | ORIGINAL_REQUEST §R1, R2 | 5 | 5 | ✓ |

## Test Architecture
- **Test Command**: Run Electron and verify that the window is created and loads the UI from `public` without console/network errors or connection refusals.
- **Verification Command**:
  ```powershell
  $env:PATH = "C:\Users\Angel\node\node-v20.9.0-win-x64;" + $env:PATH
  # Check if Electron starts up and does not throw ERR_CONNECTION_REFUSED
  ```

## Coverage Thresholds
- Tier 1: UI Loads correctly in normal launch mode.
- Tier 2: Boundary conditions (dev server stopped, app run from unpacked directory).
- Tier 3: Cross-feature combinations (running unpacked vs packed).
- Tier 4: Real-world application scenarios.
