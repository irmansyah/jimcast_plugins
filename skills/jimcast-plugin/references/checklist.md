# Pre-flight checklist

- [ ] `package.json`: `name`, `main: "dist/index.mjs"`, `type: "module"`, `jimcast.capabilities`, `jimcast.widgets[]`
- [ ] widget id = `<name>.<widgets[].id>`
- [ ] `tsdown.config.ts` bundles `@jimcast/*`
- [ ] item ids unique, stable, `ext…` prefixed
- [ ] CLI spec id `<plugin id>`, not a core name
- [ ] every interpolated shell value goes through `shq()`
- [ ] state under `~/.jimcast/plugin-data/<plugin id>/`; missing files handled
- [ ] colors from `ctx.host.theme.colors` with fallbacks
- [ ] destructive actions confirm; deletes go to Trash
- [ ] `pnpm typecheck` passes
- [ ] README: build/install, panel entry JSON, CLI examples, "Differences" if it is a port
- [ ] row added to root `README.md` and `docs/plugin-catalog.md`
