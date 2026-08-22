// [plugins] jimcast-react-rest/src/domain/restCommands.ts

import type { CommandLineRegistry, Feedback } from "@jimcast/react-sdk/react";
import type { RestWorkspace } from "../hooks/useRestWorkspace";
import type { HeaderKV, HttpMethod } from "../types";
import { callHost } from "@jimcast/react-sdk/client";
import { METHODS } from "./constants";

export function buildRestCommands(
  workspace: RestWorkspace,
  notify: (f: Feedback) => void,
): CommandLineRegistry {
  return [
   {
      name: "ping",
      usage: "ping",
      run: () => {
        callHost<{ pong: boolean; at: number }>("ping", {})
          .then((result) => {
            notify({ type: "ok", text: `pong at ${new Date(result.at).toLocaleTimeString()}` });
          })
          .catch((e) => {
            notify({ type: "ok", text: `ping failed: ${e instanceof Error ? e.message : String(e)}` });
          });
        return { ok: true, message: "Pinging host…" };
      },
    },
    {
      name: "new",
      aliases: ["n"],
      usage: "new [name]",
      run: ({ rest }) => {
        workspace.handleNew();
        // handleNew always creates an untitled request — rename it if a name was given.
        if (rest) workspace.updateSelected({ name: rest });
        return { ok: true, message: `Created "${rest || "Untitled request"}"` };
      },
    },
    {
      name: "delete",
      aliases: ["d"],
      usage: "delete [name|#]",
      run: ({ rest }) => {
        const target = workspace.resolveTarget(rest);
        if (!target) return { ok: false, message: `No request found for "${rest}"` };
        return {
          confirm: true,
          message: `Delete "${target.name || target.url}"? y/n`,
          onConfirm: () => {
            workspace.handleDelete(target.id);
            notify({ type: "ok", text: `Deleted "${target.name || target.url}"` });
          },
          onCancel: () => notify({ type: "ok", text: "Delete cancelled" }),
        };
      },
    },
    {
      name: "send",
      aliases: ["s"],
      usage: "send [name|#]",
      run: ({ rest }) => {
        const target = workspace.resolveTarget(rest);
        if (!target) return { ok: false, message: "No request to send" };
        workspace.handleSend(target);
        return { ok: true, message: `Sending "${target.name || target.url}"…` };
      },
    },
    {
      name: "open",
      aliases: ["o"],
      usage: "open <name|#>",
      run: ({ rest }) => {
        const target = workspace.resolveTarget(rest);
        if (!target) return { ok: false, message: `No request found for "${rest}"` };
        const idx = workspace.requests.findIndex((r) => r.id === target.id);
        workspace.selectRequest(target.id, idx, true);
        return { ok: true, message: `Opened "${target.name || target.url}"` };
      },
    },
    {
      name: "method",
      aliases: ["m"],
      usage: "method GET|POST|PUT|PATCH|DELETE",
      run: ({ rest }) => {
        if (!workspace.selectedRequest) return { ok: false, message: "No request open" };
        const up = rest.trim().toUpperCase();
        if (!METHODS.includes(up as HttpMethod)) {
          return { ok: false, message: `Unknown method "${rest}" — use GET/POST/PUT/PATCH/DELETE` };
        }
        workspace.updateSelected({ method: up as HttpMethod });
        return { ok: true, message: `Method set to ${up}` };
      },
    },
    {
      name: "url",
      aliases: ["u"],
      usage: "url <url>",
      run: ({ rest }) => {
        if (!workspace.selectedRequest) return { ok: false, message: "No request open" };
        workspace.updateSelected({ url: rest });
        return { ok: true, message: "URL updated" };
      },
    },
    {
      name: "name",
      aliases: ["rename"],
      usage: "name <text>",
      run: ({ rest }) => {
        if (!workspace.selectedRequest) return { ok: false, message: "No request open" };
        workspace.updateSelected({ name: rest });
        return { ok: true, message: "Name updated" };
      },
    },
    {
      name: "header",
      usage: "header <name> <value>",
      run: ({ rest }) => {
        const sel = workspace.selectedRequest;
        if (!sel) return { ok: false, message: "No request open" };
        const [key, ...valParts] = rest.split(/\s+/);
        if (!key) return { ok: false, message: "Usage: header <name> <value>" };
        const value = valParts.join(" ");
        const existingIdx = sel.headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
        let nextHeaders: HeaderKV[];
        if (existingIdx >= 0) {
          nextHeaders = sel.headers.map((h, i) => (i === existingIdx ? { key, value } : h));
        } else {
          const blankIdx = sel.headers.findIndex((h) => !h.key.trim());
          nextHeaders =
            blankIdx >= 0
              ? sel.headers.map((h, i) => (i === blankIdx ? { key, value } : h))
              : [...sel.headers, { key, value }];
        }
        workspace.updateHeaders(nextHeaders);
        return { ok: true, message: `Header "${key}" set` };
      },
    },
    {
      name: "body",
      usage: "body <text>",
      run: ({ rest }) => {
        if (!workspace.selectedRequest) return { ok: false, message: "No request open" };
        workspace.updateSelected({ body: rest });
        return { ok: true, message: "Body updated" };
      },
    },
    {
      name: "clear",
      usage: "clear",
      run: () => {
        workspace.clearResponse();
        return { ok: true, message: "Response cleared" };
      },
    },
  ];
}
