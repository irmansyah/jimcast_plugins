# Plugin catalog

The plugin id is the `package.json` `name`, the install folder under `~/.jimcast/plugins/`, the id of the plugin's main widget and its CLI/keys id. Extra widgets are `<plugin id>.<local id>`. Plugin state lives in `~/.jimcast/plugin-data/<plugin id>/`.

| Plugin | Folder | Plugin id | State | Refresh |
|---|---|---|---|---|
| pomodoro | `plugins/jim-pomodoro` | `com.jimcast.plugins.pomodoro` | `plugin-data/<plugin id>/state` (+ `state.pid`) | 1 s |
| aiagents | `plugins/jim-aiagents` | `com.jimcast.plugins.aiagents` | `plugin-data/<plugin id>/` (`tab`, `feed.json`) | 3 s |
| finder | `plugins/jim-finder` | `com.jimcast.plugins.finder` | SDK storage (`~/.jimcast/system/storage/<plugin id>.json`) | none |
| calendar | `plugins/jim-calendar` | `com.jimcast.plugins.calendar` | `plugin-data/<plugin id>/` | 60 s |
| color picker | `plugins/jim-colorpicker` | `com.jimcast.plugins.colorpicker` | `plugin-data/<plugin id>/` | none |
| emoji picker | `plugins/jim-emojipicker` | `com.jimcast.plugins.emojipicker` | `plugin-data/<plugin id>/` | none |
| restapi | `plugins/jim-restapi` | `com.jimcast.plugins.restapi` | SDK storage | none |
| hello (example) | `examples/hello` | `com.jimcast.examples.hello` | none | none |
| counter (example) | `examples/counter` | `com.jimcast.examples.counter` | `plugin-data/<plugin id>/` | none |

## Install

```bash
./scripts/install.sh jim-pomodoro      # one plugin (folder name)
./scripts/install.sh --all             # everything under plugins/
```

This builds the plugin and copies `dist/` and `package.json` to `~/.jimcast/plugins/<plugin id>/`. Fully quit and relaunch jimcast-core afterwards: plugin processes outlive reloads.

## Config

Place a plugin with a catalog alias in `config.json`, then use the alias in `config_section.json` or on the CLI:

```json
"widgets": {
  "pomodoro": { "use": "com.jimcast.plugins.pomodoro" }
}
```

```bash
jimcast widget command pomodoro toggle
```

## Adding a plugin from another folder

```bash
./scripts/import-plugin.sh ~/path/to/plugin [folder-name]
```

Then rename its `package.json` `name` to a reverse-DNS id (`com.jimcast.plugins.<x>`), follow the conversion checklist, and add its row here and in the root README.
