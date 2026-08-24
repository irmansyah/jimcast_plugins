# Carry-forward — jimcast-external-file-manager migration + clean architecture

## Status: migration + clean-architecture split is functionally complete

All three original SDK blockers were resolved, and the last remaining
piece — splitting the 633-line `FileExplorerPlugin.tsx` — is now done.
Every file in the plugin has been ported off the in-core `plugin-sdk`/
`designSystem`/`globalSetup` imports onto `@jimcast/react-sdk` /
`@jimcast/protocol`, and reorganized into
`domain/application/infrastructure/presentation`.

## Full file tree

```
jimcast-external-file-manager/
├── manifest.json                        capabilities: ["shell", "fs:read"]
└── src/
    ├── types.ts                         FileEntry, ColumnData, FooterMode, SelectionAnchor
    ├── App.tsx                          useTheme() + fileExplorerStyles(theme) + mount FileExplorerShell
    ├── styles.ts                        fileExplorerStyles(theme: ThemeContext) — see approximation notes in file header
    │
    ├── domain/                          pure, zero React/SDK imports
    │   ├── fileSystemLogic.ts           parseLsEntries, resolveHome, buildPath, basename,
    │   │                                 entryFullPath, visibleEntries, isAvFile, truncateMiddle,
    │   │                                 ALLOW_DIRECTORIES/ALLOWED_ROOT_NAMES
    │   └── selectionLogic.ts            toggleSelection, rangeSelect, selectAllFilesInColumn,
    │                                     toggleFocusedSelection — see file header for the
    │                                     preserved segments-slicing quirk (intentional, not a bug)
    │
    ├── application/                     orchestration — domain + infra, no React
    │   ├── columnLoading.ts             loadHomeDir, loadColumn, loadColumns
    │   ├── fileOperations.ts            deleteFiles, renameFile, runShellCommand
    │   └── fileOpening.ts               openSelection — unifies 3 duplicated call sites from the original
    │
    ├── infrastructure/                  anything touching the host/Node
    │   ├── backendClient.ts             shellExec/openPaths/startDrag/openWithSystemPlayer/
    │   │                                 reportFocusedItem/reportDragStarted, via @jimcast/react-sdk/client
    │   └── backend.ts                   Node entry — defineWebviewBackend(), same handler table as before
    │
    └── presentation/
        ├── hooks/
        │   ├── useFileExplorerWorkspace.ts   central state hook — all useState/refs/action callbacks
        │   ├── useFileExplorerKeyboard.ts    global keydown handler (d/m/!/space/shift-h/cmd-a/cmd-c)
        │   └── useFileExplorerNav.ts         useHostNav wiring, via @jimcast/react-sdk/react
        └── components/
            ├── FileExplorerShell.tsx    pure composition — zero business logic
            ├── ColRow.tsx                mousedown-drag-arming + scroll-into-view, isolated
            ├── Breadcrumbs.tsx
            ├── CommandFooter.tsx         hint/confirm-delete/rename/shell states
            └── IconButton.tsx
```

## Notable decisions/fixes made during the split

- **`fileOpening.ts`'s `openSelection()`** unifies three near-identical
  branches the original had inlined separately (`openEntry`'s
  non-directory case, `handleRowDoubleClick`, and the nav hook's
  `onActivate`) — same AV-file-vs-default-opener decision, now one
  function instead of three copies.
- **Real bug caught during extraction**: the loading-placeholder columns
  in the segments/refreshTick effect had briefly lost their real `path`
  values in an early draft of the split (all would've shared React key
  `''` during the load flicker). Fixed — `useFileExplorerWorkspace.ts`
  rebuilds the actual per-column paths for the placeholder array, matching
  the original's `key={col.path}` uniqueness.
- **`useFileExplorerNav.ts`** is a straight import-path port, not an
  adapter — `useHostNav`'s real signature turned out to already match the
  `{onArrow, onActivate}` shape the component used against the old
  in-core `plugin-sdk`, so no wrapper hook was needed (the possibility of
  needing one was the original blocker #1; it resolved without needing
  the fallback).
- Presentation components (`ColRow`, `Breadcrumbs`, `CommandFooter`) each
  type their `styles` prop as a narrow interface of just the keys they
  use; `FileExplorerShell.tsx` passes the full `Record<string,
  CSSProperties>` from `styles.ts` into all of them without a cast — this
  works because an index-signature type structurally satisfies any
  interface whose properties are all the same value type.

## Still-open items (not blockers, small/deferred)

1. **`@jimcast/protocol` root exports** — `styles.ts` imports
   `ThemeColors`/`ThemeTypography`/`ThemeSpacing`/`px` from the bare
   `@jimcast/protocol` root, but that package's `src/index.ts` was only
   confirmed to export `{ resolveTheme, defaultTheme, ThemeContext }`.
   Needs either adding those four names to the root export line, or
   confirming a deep-import path works if the package's `exports` map
   allows it (unconfirmed either way — `packages/protocol/package.json`
   itself was never pasted).
2. **`alpha()` opacity approximation** in `styles.ts` (25%/60% for
   muted/heavy) — designSystem.ts's real values were never shown, so
   these are reasonable defaults, not confirmed originals. Purely visual,
   not a build blocker.
3. **`space.xs` → `spacing.gapSm` mapping** — lossy (old 4-tier scale
   onto ThemeSpacing's 3-tier gap scale). Also purely visual.
4. **`renderWidget`/`executeCommand` handler shapes in `backend.ts`** —
   carried over unchanged from the old backend.ts with the same
   pre-existing caveat: UNVERIFIED against `[core]`'s real widget-content
   schema (`domain/widget/types.ts`). Was never confirmed in either
   session, not specific to this migration.

None of these block a build — they're either visual-fidelity guesses
worth eyeballing once running, or a package-export addition that's a
one-line fix once picked up.

## What's needed next
Nothing required to keep going — the migration is code-complete pending
whoever actually builds/runs it and eyeballs the two visual
approximations (#2, #3 above) against the real app. If item #1 (protocol
root exports) turns out to be missing, that's a small change in
`packages/protocol/src/index.ts`, not in this plugin.
