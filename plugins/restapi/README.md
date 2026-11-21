<!-- README.md -->
# jim-restapi

External-plugin port of the built-in REST API widget. Requests on the left, the response of the
last run on the right.

- **Enter / click** on a request runs it with `curl` and shows the output.
- **First row** (app title) cycles through the config files.

## Install

```bash
jimcast plugin install restapi
# or by package id:
jimcast plugin install com.jimcast.plugins.restapi
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `restapi` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "restapi": { "use": "com.jimcast.plugins.restapi" } }
```

The alias only declares the widget. To show it, place `restapi` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh restapi
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Configs

Drop one or more `user_config.json`-format files (or symlinks) into:

```
~/.jimcast/ext-restapi/configs/
```

Supported fields: `app_title`, `base_url`, `variable_dir`, `variable_access_token_file`, `headers`,
and `requests[]` with `req_tag`, `req_title`, `req_type`, `req_end_point`,
`req_body: { body_type: "RAW", body_file }`, `req_variable_type: "Bearer"`,
`req_variable_is_save` + `req_variable_response_value` (`{ "ACCESS_TOKEN.txt": "data.access_token" }`).

Requires `curl`; `jq` for pretty-printing and for saving response variables.

## CLI

```sh
jimcast widget command xrestapi list
jimcast widget command xrestapi run <req_tag|title>
jimcast widget command xrestapi status [--json]
```

## Differences from the built-in

- Widget id `com.jimcast.plugins.restapi`; CLI spec id `xrestapi` (was `rest`); item ids use the
  `extra` prefix (`extra:<tag>`, `extra-config`, `extra-status`, `extra-out:<n>`, `extra-msg`).
- State lives in `~/.jimcast/ext-restapi/` (was `~/.jimcast/restapi/`), including `configs/`. Copy or
  symlink your configs over.
- Default `variable_dir` is `~/.jimcast/ext-restapi/_variables`. Configs that set `variable_dir`
  explicitly are unaffected.
- `shellExec` options (`ignore_exit_code`, `trim_output`, `timeout_secs`) are dropped. `ctx.exec` has
  no timeout, so the 20 s action timeout is gone. `curl -m 15` still bounds the request itself.
- Request params (`{h}` `{b}` `{u}`) are no longer passed through interpolation. They are built into
  the script directly, since actions are closures.
- Theme fonts (`xs`, `sm`) are local constants, and every theme color has a fallback.
