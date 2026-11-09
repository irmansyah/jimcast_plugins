<!-- README.md -->
# jimcast-external-restapi

External-plugin port of the built-in REST API widget. Requests on the left, the response of the
last run on the right.

- **Enter / click** on a request runs it with `curl` and shows the output.
- **First row** (app title) cycles through the config files.

## Install

```sh
pnpm install && pnpm build && pnpm typecheck
```

Then install the plugin folder into jimcast and add this entry to your panel config:

```json
{ "id": "jimcast-external-restapi.restapi" }
```

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

- Widget id `jimcast-external-restapi.restapi`; CLI spec id `xrestapi` (was `rest`); item ids use the
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
