// [plugin] jim-aiagents/src/commands.ts
import type { WidgetCliCommand, WidgetCliContext } from "@jimcast/sdk";
import { loadAgents } from "./data.js";
import { cliItem } from "./render.js";
import { ALL_ID, setTabCmd } from "./shell.js";

const positional = (ctx: WidgetCliContext) => ctx.args.filter((a) => !a.startsWith("--"));

export const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "status",
    title: "All agents with status and progress",
    async run(ctx) {
      const agents = await loadAgents(ctx);
      return agents
        .map((a) => `${a.id}\t${a.status}\t${Math.round(a.progress * 100)}%\t${a.task}`)
        .join("\n") || "(no agents)";
    },
  },
  {
    id: "use",
    args: ["all|agent-id"],
    title: "Open a tab",
    async run(ctx) {
      const q = positional(ctx).join(" ").toLowerCase();
      if (!q) throw new Error("use needs a tab (all or an agent id)");
      const agents = await loadAgents(ctx);
      const hit = q === ALL_ID
        ? ALL_ID
        : agents.find((a) => a.id.toLowerCase() === q || a.name.toLowerCase() === q)?.id;
      if (!hit) throw new Error(`unknown tab: ${q} (see \`xagents status\`)`);
      await ctx.dispatch(cliItem(ctx, "use", setTabCmd(hit)));
      return `Showing ${hit}`;
    },
  },
];
