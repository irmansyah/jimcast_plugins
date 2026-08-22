# jimcast-react-rest

A jimcast-core external plugin: a keyboard-driven REST client webview with a
vim-style `:command` line, built on `@jimcast/react-sdk`.

## Structure

```
src/
  App.tsx                 — composition root only
  types.ts                — shared domain types
  domain/
    constants.ts           — METHODS
    requestUtils.ts         — newId, resolveTarget
    restCommands.ts         — CommandLineRegistry for the ":" command bar
    focusRelative.ts         — shared arrow-key field navigation
  data/
    seedRequests.ts          — starter SavedRequest entries
  hooks/
    useRestWorkspace.ts      — requests/response/CRUD/send state
    useRestCommandLine.ts    — wires restCommands + useCommandLine (SDK)
    useGlobalKeyboard.ts     — document-level shortcuts
  components/
    TopBar.tsx
    RequestSidebar.tsx
    RequestEditor.tsx
    ResponsePanel.tsx
    CommandFooter.tsx
    HelpModal.tsx
  styles.ts                 — component CSS as a template string
  backend.ts                — plugin backend entry (stdio NDJSON to host)
  main.tsx / index.css      — Vite webview entry
```

## Build

```
pnpm install
pnpm build          # builds both the webview (Vite) and the backend (esbuild)
```

This produces `dist/` (webview, referenced by `manifest.json`'s `entry`) and
`dist-backend/backend.js` (the Node process jimcast-core's plugin_runtime
spawns and talks to over stdio).

## Note on the SDK dependency

`package.json` currently declares `@jimcast/react-sdk` via `workspace:*`.
If this repo isn't actually inside the same pnpm workspace as
`jimcast-sdk`, swap that for a `file:../path/to/jimcast-sdk/packages/react-sdk`
link instead, and rerun `pnpm install`. See the SDK's own README for
details on `./client`, `./server`, and `./react` subpath exports.
