# Phase A — carry-forward from this session

## What's done (drop-in replacements)

All ten files below are complete, self-contained, and match the real APIs
confirmed in the prior session's carry-forward doc (`useCommandLine`'s real
shape, `getHostStorage`/`useHostStorage`, `Record<string,string>` args).

```
src/types.ts                              — Card.archived?: boolean added
src/domain/kanbanLogic.ts                 — +addColumn/renameColumn/deleteColumn/
                                             moveColumn/archiveCard
src/domain/kanbanCommands.ts              — now composes the four modules below
src/domain/commands/boardCommands.ts      — list-boards/new-board/delete-board/board
src/domain/commands/columnCommands.ts     — NEW: new-column/rename-column/
                                             delete-column/move-column, +focus
src/domain/commands/cardCommands.ts       — new/delete/move/rename, + NEW
                                             archive/unarchive/archived
src/domain/commands/utilityCommands.ts    — NEW: search/clear-search, and
                                             list/commands/? (opens help modal)
src/hooks/useKanbanWorkspace.ts           — +column ops, archive/unarchive,
                                             visibleColumns (search-filtered,
                                             archived-hidden), runSearch/clearSearch
src/components/HelpModal.tsx              — optional `commands` prop, renders
                                             a second "Commands" section
src/backend.ts                            — +new-column/rename-column/
                                             delete-column/move-column/
                                             archive-card/unarchive-card
```

Item 5 from the original list (the three duplicate "Q1 Goals" boards from
CLI testing) — left alone. Your call whether to `:delete-board` them or keep
as smoke-test fixtures; nothing here touches them.

## What's NOT done — needs files this session didn't have

I didn't have `App.tsx`, `BoardView.tsx`, `ColumnView.tsx`, `CardItem.tsx`,
`CardModal.tsx`, `CommandFooter.tsx`, or `useGlobalKeyboard.ts` this session.
Rather than guess their shape (see the prior session's `useHostStorage`/
`useCommandLine`/`call_host_primitive` walk-backs), everything above was
built to be correct standalone, with two explicit hookups left for you or a
follow-up session with those files in hand:

### 1. Wire `openHelp` from App.tsx into `buildKanbanCommands`

`buildKanbanCommands(workspace, notify, openHelp?)` takes an optional third
arg. Whatever currently owns the help-modal-open boolean (toggled by the
`toggleHelp` keymap action, per the original `HelpModal.tsx` comment "keymap
only, NOT the :command registry" — likely a `useState` in `App.tsx`) needs to
pass its setter through:

```tsx
// wherever buildKanbanCommands is currently called with (workspace, notify)
const [helpOpen, setHelpOpen] = useState(false); // may already exist
const commands = buildKanbanCommands(workspace, notify, () => setHelpOpen(true));

// wherever <HelpModal keymap={...} onClose={...} /> is currently rendered
<HelpModal keymap={keymap} commands={commands} onClose={() => setHelpOpen(false)} />
```

Until this is wired, `:list`/`:commands`/`:?` fall back to the old
toast-of-usage-strings behavior (harmless, just not the upgrade).

### 2. Swap `BoardView.tsx` to render `workspace.visibleColumns` instead of `workspace.columns`

This is what actually makes `:search`/`:archive` visible. `visibleColumns` is
the same `Column[]` shape as `columns`, just with archived cards stripped and
(when a search is active) non-matching cards filtered out — so this should
be a one-line prop swap in whatever passes columns down to `ColumnView`, no
shape changes needed on that end. If `ColumnView`/`CardItem` render anything
keyed off `card.archived` (they shouldn't need to, since archived cards are
already filtered out before reaching them) — no change needed there either.

### 3. Not done, flagged only: `useGlobalKeyboard.ts` still has no column
keybindings (only the `:new-column`/etc *commands* exist). If column
operations should also be keyboard-driven (not just `:`-driven), that needs
a `keymap.ts` extension (new `Action`s like `newColumn`/`deleteColumn`) and
`useGlobalKeyboard.ts` dispatch — out of scope for what was requested this
round, but worth deciding before Phase B reuses this file's pattern
verbatim, since Phase B's plan explicitly calls out reusing
`useGlobalKeyboard.ts`'s shape.

## Build/rebuild note (per the prior session's #1 gotcha)

These are all plugin-side TypeScript files — no `jimcast-core` Rust rebuild
needed. `pnpm build` inside `jimcast-react-kanban-v2` (or however this
plugin's dev loop runs) should be enough to pick everything up.
