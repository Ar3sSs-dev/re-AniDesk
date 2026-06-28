# Plan - Fix AniDesk Launch Failure

## Objective
Identify why the AniDesk Electron application fails to load the UI and shows a blank/silent screen when launched, and fix the launch logic or repack it to resolve the problem.

## Milestones and Verification Steps

### Milestone 1: Initialize Project and Test Infrastructure
- **Description**: Setup project documentation, verify current workspace, and define test harness command.
- **Verification**: Ensure `PROJECT.md` and `TEST_INFRA.md` exist and contain correct layout/strategy.

### Milestone 2: Code Investigation and Launch Failure Root Cause
- **Description**: Spawn Explorer to analyze the Electron main process startup path, env check logic (`isDev`), and packaging status.
- **Verification**: Reviewer confirms the root cause analysis and recommendations.

### Milestone 3: Implement Fix (Main JS Fix or Asar Repacking)
- **Description**: Spawn Worker to implement the chosen resolution path (either fixing `main.js` or packing to `app.asar` and removing the backup).
- **Verification**: Worker runs build/test verification commands. Reviewer reviews code correctness and stability.

### Milestone 4: Adversarial Coverage Hardening and Final Audits
- **Description**: Run tests under various conditions (e.g. package vs unpack, dev server running vs stopped) to verify UI loading behaves as expected. Spawn Forensic Auditor to verify no hardcoded cheats.
- **Verification**: Forensic Auditor reports clean audit verdict.

### Milestone 5: Victory Audit and Final Report
- **Description**: Perform final Victory Audit, write handoff, and report results to user.
- **Verification**: All E2E test suites pass and final report is generated.
