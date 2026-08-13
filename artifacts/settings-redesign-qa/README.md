# Settings Structural Redesign QA

- `desktop/`: 18 Settings routes, permission, error, and dialog states at a 1440 × 1050 viewport
- `mobile/`: the same 18 states at a 390 × 844 viewport
- `comparison-before-after.png`: normalized 1440 × 900 source/implementation comparison
- `qa-results.json`: interaction, overflow, and console-error checks

The set covers Workspace General, Study Rules, Members, Notifications,
Repository Connection, Data & Sync, Profile, Connected Account, Appearance,
Security & Audit, Workspace Danger, Account Management, both destructive
dialogs, migration success/blocked states, Provider reauthorization, and
non-owner danger permissions.
