// [plugin] jimcast-external-restapi/src/commands.ts
import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import { loadState, methodOf, runCmd, urlOf } from "./data.js";
import { cliItem } from "./render.js";
import { CONFIGS_HINT } from "./shell.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "list",
    title: "List the requests of the active config",
    async run(ctx) {
      const st = await loadState(ctx);
      if (!st.cfg) throw new Error(st.cfgError || `no config (see ${CONFIGS_HINT})`);
      return st.cfg.requests
        .map((r) => `${r.req_tag}\t${methodOf(r)}\t${urlOf(st.cfg!, r)}`)
        .join("\n");
    },
  },
  {
    id: "run",
    args: ["tag|title"],
    title: "Run a request and print the response",
    async run(ctx) {
      const q = positional(ctx).join(" ").toLowerCase();
      if (!q) throw new Error("run needs a req_tag or title (see `xrestapi list`)");
      const st = await loadState(ctx);
      if (!st.cfg) throw new Error(st.cfgError || `no config (see ${CONFIGS_HINT})`);
      const r = st.cfg.requests.find(
        (x) => x.req_tag.toLowerCase() === q || (x.req_title ?? "").toLowerCase() === q,
      );
      if (!r) throw new Error(`unknown request: ${q} (see \`xrestapi list\`)`);
      await ctx.dispatch(cliItem(ctx, r.req_tag, runCmd(st.cfg, r)));
      const after = await loadState(ctx);
      if (after.status.startsWith("error|")) throw new Error(after.status.slice(6));
      const [, line, saved] = after.status.split("|");
      return [line + (saved?.trim() ? `  (saved${saved})` : ""), "", ...after.out].join("\n");
    },
  },
  {
    id: "status",
    title: "Status and output of the last request",
    description: "--json for machine-readable output",
    async run(ctx) {
      const st = await loadState(ctx);
      if (ctx.args.includes("--json")) {
        return {
          config: st.config,
          selected: st.selected,
          status: st.status,
          hasToken: st.hasToken,
          out: st.out,
        };
      }
      return [
        `config  ${st.config || "(none)"}`,
        `request ${st.selected || "(none)"}`,
        `status  ${st.status || "(none)"}`,
        `token   ${st.hasToken ? "yes" : "no"}`,
        "",
        ...st.out,
      ].join("\n");
    },
  },
];
